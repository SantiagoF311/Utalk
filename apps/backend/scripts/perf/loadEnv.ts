// Parser mínimo de .env para los scripts de scripts/perf/: evita agregar
// `dotenv` como dependencia del backend solo para estos scripts puntuales.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

export function loadEnv(): Record<string, string> {
  const envPath = resolve(scriptsDir, '../../.env');
  const result: Record<string, string> = { ...process.env } as Record<string, string>;

  let content: string;
  try {
    content = readFileSync(envPath, 'utf-8');
  } catch {
    return result;
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (result[key] === undefined) {
      result[key] = value;
    }
  }

  return result;
}
