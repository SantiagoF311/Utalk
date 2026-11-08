import { COMMUNITY_TOPICS } from '@utalk/shared';
import type { CommunityTopic } from '@utalk/shared';

// Cómo se muestra cada tema de comunidad (la lista vive en @utalk/shared).
export const COMMUNITY_TOPIC_LABELS: Record<CommunityTopic, string> = {
  academic: 'Académico',
  campus_life: 'Vida en el campus',
  marketplace: 'Compraventa',
  events: 'Eventos',
  sports: 'Deportes',
  venting: 'Desahogo',
  lost_and_found: 'Perdidos y encontrados',
  other: 'Otros',
};

export const COMMUNITY_TOPIC_OPTIONS = COMMUNITY_TOPICS.map((topic) => ({
  value: topic,
  label: COMMUNITY_TOPIC_LABELS[topic],
}));

export function memberCountLabel(count: number): string {
  return count === 1 ? '1 miembro' : `${count} miembros`;
}

// Nombre → slug para c/<slug>: sin tildes, minúsculas, solo letras, números
// y guion bajo ("Cálculo II" → "calculo_ii").
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}
