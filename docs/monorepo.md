# Monorepo

## Herramienta: npm workspaces

Se usa **npm workspaces** (nativo desde npm 7) en lugar de pnpm/yarn
workspaces o herramientas de build como Turborepo o Nx.

### Por qué

- Ambas apps (`apps/backend`, `apps/mobile`) ya usaban `package-lock.json`
  (npm), no `pnpm-lock.yaml` ni `yarn.lock` — usar npm workspaces evita
  migrar de gestor de paquetes solo para tener monorepo. Hoy hay un
  **único `package-lock.json`, en la raíz**: los que tenía cada app se
  borraron y están en `.gitignore` (`apps/*/package-lock.json`), porque
  npm workspaces los ignora y solo reaparecen si alguien corre
  `npm install` dentro de una app.
- El proyecto tiene 3 paquetes (`backend`, `mobile`, `shared`). A este
  tamaño, herramientas de orquestación de builds como Turborepo o Nx son
  sobre-ingeniería: no hay suficientes paquetes ni tiempos de build lo
  bastante largos como para necesitar cache de builds o ejecución
  incremental. Ver [decisiones-descartadas.md](./decisiones-descartadas.md).

### Cuándo reconsiderar

Cuando `npm run build` en la raíz empiece a tardar de forma notoria porque
rebuildea todo aunque solo cambió un archivo, o cuando se necesite que CI
solo testee los paquetes afectados por un PR — ahí vale la pena evaluar
Turborepo.

## Estructura

```
Utalk/
├── package.json          # raíz: declara los workspaces
├── apps/
│   ├── backend/           # NestJS — paquete "backend"
│   └── mobile/            # Expo (React Native) — paquete "tempora"
└── packages/
    └── shared/            # @utalk/shared — tipos/schemas compartidos
```

El `package.json` raíz declara:

```json
{
  "name": "utalk",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

Cualquier carpeta bajo `apps/*` o `packages/*` con su propio `package.json`
se convierte automáticamente en un paquete del workspace.

## `packages/shared` (`@utalk/shared`)

Paquete sin build propio — se consume directo como fuente TypeScript desde
los workspaces que dependen de él. Declarado con:

```json
"dependencies": { "@utalk/shared": "*" }
```

en `apps/backend/package.json` y `apps/mobile/package.json`. El `*` le dice
a npm que resuelva al paquete local del workspace en vez de buscarlo en el
registro de npm.

### Para qué sirve

Una sola fuente de verdad para los contratos de datos entre backend y
mobile — evita mantener a mano tipos duplicados que se desincronizan con
el tiempo. Casos de uso concretos identificados:

- Tipos/schemas de dominio (`Post`, `Comment`, `User`, etc.) — pendientes
  de definir.
- Payloads de los jobs de BullMQ (ej. `notifySubscribersJobSchema` /
  `NotifySubscribersJob`, en `notification.ts`), para
  que el código que encola un job y el worker que lo procesa compartan
  exactamente el mismo contrato.

Usa **Zod** para definir schemas validables en runtime, no solo tipos
estáticos de TypeScript.

## Cómo instalar y trabajar con el monorepo

- **Instalar todo**: `npm install` desde la raíz `Utalk/`. Nunca correr
  `npm install` dentro de `apps/backend/` o `apps/mobile/` por separado —
  eso rompe el enlace de workspace y duplica dependencias.
- **Agregar una dependencia a un workspace específico**:
  `npm install <paquete> -w apps/mobile` (o `-w apps/backend`,
  `-w packages/shared`).
- **Scripts de conveniencia** (definidos en el `package.json` raíz):
  - `npm run backend` — levanta NestJS en modo watch
  - `npm run mobile` — levanta Expo
  - `npm run mobile:android` / `npm run mobile:ios` / `npm run mobile:web`
  - `npm run backend:build` / `npm run backend:test`
  - `npm run lint` — corre lint en backend y mobile

## Cómo funciona la resolución de dependencias (hoisting)

npm centraliza la mayoría de las dependencias en un único `node_modules`
en la raíz, en vez de duplicarlas por cada app. Reglas generales:

- Si todos los workspaces que piden una dependencia pueden compartir una
  misma versión (los rangos semver se solapan), esa versión se **hoistea**
  a la raíz (`Utalk/node_modules/`).
- Si hay conflicto de versiones entre workspaces (un workspace pide un
  rango que no calza con lo que otro necesita, directa o
  transitivamente), la versión que no puede compartirse queda **anidada**
  dentro del `node_modules` del workspace que la generó — puede pasar
  tanto en `apps/backend/node_modules` como en `apps/mobile/node_modules`,
  no hay preferencia por ninguno de los dos.
- Los paquetes propios del workspace (como `@utalk/shared`) se resuelven
  como un **symlink** en `node_modules/@utalk/shared` apuntando a
  `packages/shared/` — así el import funciona igual que un paquete
  publicado, pero en realidad apunta al código fuente local.

Este comportamiento es automático y no requiere configuración manual.

## Compatibilidad con Metro (Expo)

Desde Expo SDK 52+, el soporte de monorepos con npm/pnpm/yarn/bun es
automático — no fue necesario tocar `metro.config.js`. Verificado
arrancando Metro y confirmando que resuelve `@utalk/shared` tanto en el
bundle SSR como en el bundle web sin errores de resolución.
