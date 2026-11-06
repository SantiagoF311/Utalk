# UTalk — mobile

App de UTalk con Expo (React Native) y Expo Router.

## Correr la app

Todo desde la **raíz del repo** (es un monorepo con npm workspaces: nunca
correr `npm install` dentro de `apps/mobile`):

```bash
npm install          # una vez, desde la raíz
npm run mobile       # levanta Expo
```

Antes, copiar `apps/mobile/.env.example` a `apps/mobile/.env` y completar
los valores. El backend tiene que estar corriendo (`npm run backend`).

## Documentación

- [docs/mobile.md](../../docs/mobile.md): estructura, navegación, datos
  con TanStack Query, errores y variables de entorno.
- [docs/monorepo.md](../../docs/monorepo.md): cómo funcionan los
  workspaces y las dependencias.
