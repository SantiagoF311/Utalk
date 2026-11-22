import { Logger } from '@nestjs/common';
import type {
  Classification,
  ContentClassifier,
  ContentToClassify,
} from '../domain/contentClassifier.js';

// API de moderación de OpenAI: gratis, revisa texto e imágenes en un mismo
// pedido. https://platform.openai.com/docs/guides/moderation
const MODERATIONS_URL = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';

interface ModerationResponse {
  results: { flagged: boolean; categories: Record<string, boolean> }[];
}

export class OpenAiContentClassifier implements ContentClassifier {
  constructor(private readonly apiKey: string) {}

  async classify(content: ContentToClassify): Promise<Classification> {
    const input: object[] = [{ type: 'text', text: content.text }];
    if (content.imageUrl) {
      input.push({ type: 'image_url', image_url: { url: content.imageUrl } });
    }

    const response = await fetch(MODERATIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input }),
    });
    // Un 429 (rate limit) o un error de OpenAI: BullMQ reintenta el job.
    if (!response.ok) {
      throw new Error(`OpenAI moderation failed with ${response.status}: ${await response.text()}`);
    }

    // Con varias partes (texto + imagen) OpenAI devuelve un solo resultado
    // para todo el contenido.
    const { results } = (await response.json()) as ModerationResponse;
    const flagged = results.some((result) => result.flagged);
    const categories = [
      ...new Set(
        results.flatMap((result) =>
          Object.entries(result.categories)
            .filter(([, active]) => active)
            .map(([name]) => name),
        ),
      ),
    ];
    return { flagged, categories };
  }
}

// Sin OPENAI_API_KEY la moderación por IA queda apagada: nada se marca y la
// moderación sigue funcionando con los reportes de las personas.
export class DisabledContentClassifier implements ContentClassifier {
  constructor() {
    new Logger(DisabledContentClassifier.name).warn(
      'OPENAI_API_KEY is not set: AI moderation is disabled',
    );
  }

  classify(): Promise<Classification> {
    return Promise.resolve({ flagged: false, categories: [] });
  }
}
