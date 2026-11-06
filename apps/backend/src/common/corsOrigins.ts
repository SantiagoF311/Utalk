// Orígenes que pueden llamar a la API desde un navegador (CORS). La app
// nativa no manda Origin, así que CORS no la afecta: esto solo aplica a la
// versión web de Expo y a cualquier otro cliente web.
//
// Se configura con CORS_ORIGINS (separados por coma). Sin la variable, solo
// se permite el servidor de desarrollo de Expo web.
export const DEFAULT_CORS_ORIGINS = ['http://localhost:8081'];

export function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_CORS_ORIGINS;
  }
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}
