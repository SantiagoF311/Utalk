import { existsSync } from 'node:fs';
import * as Sentry from '@sentry/nestjs';

// Se importa primero en main.ts: Sentry tiene que estar listo antes que el
// resto de la app. Por eso lee el .env acá (ConfigModule lo carga recién al
// armar AppModule); en producción las variables ya vienen del entorno
// (secrets de Fly.io) y no hay .env.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const dsn = process.env.SENTRY_DSN;

// Solo errores: sin tracing ni profiling (ver docs/observabilidad.md). Sin
// SENTRY_DSN (ej. en desarrollo) queda apagado y no manda nada.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  // Por defecto el SDK recolecta casi todo. Acá nada de contenido: ni
  // cuerpos de requests (mensajes del chat, posts), ni variables locales de
  // las funciones (pueden tener esos textos o tokens), ni la query string
  // (búsquedas), ni el token de sesión. Alcanza con el stack, la ruta y el
  // método para entender el error.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { allow: ['user-agent', 'content-type'] }, response: false },
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
  },
});
