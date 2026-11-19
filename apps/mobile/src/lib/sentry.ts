import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Errores de la app (pantallas que se rompen, promesas sin atrapar). Sin
// EXPO_PUBLIC_SENTRY_DSN (ej. en desarrollo) queda apagado y no manda nada.
// Los errores de la API los reporta el backend; acá solo los del celular.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  // Nada de datos de la persona (IP, usuario). Igual que en el backend
  // (apps/backend/src/instrument.ts), no viaja contenido.
  sendDefaultPii: false,
  // El rastro de lo que pasó antes del error: sin los console.log (pueden
  // tener lo que alguien escribió) y sin la query string de los pedidos
  // (las búsquedas van ahí).
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console') return null;
    const url: unknown = breadcrumb.data?.url;
    if (typeof url === 'string' && breadcrumb.data) {
      breadcrumb.data.url = url.split('?')[0];
    }
    return breadcrumb;
  },
});

export { Sentry };
