# Estándares del equipo — UTalk

Reglas de trabajo del equipo para commits, ramas, calidad, código y tablero.
La política del tablero en Trello (WIP y Definition of Done) es la fuente de
las secciones 5 a 7. Este archivo la deja versionada junto al código.

## 1. Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/es/), en
español y en tercera persona del presente:

```
<tipo>(<ámbito opcional>): <qué hace el cambio> (<ID de historia>)
```

- Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Ámbitos: `backend`, `mobile`, `api`, `auth`, `ci`.
- Ejemplo: `feat(chat): agrega leído de mensajes (HU-09)`.
- Se usa desde el 28 oct 2026 (PR #1). Los commits anteriores
  (17–23 sep) no siguen la convención.
- El ID de la historia (`HU-xx` / `T-xx`) se exige desde la publicación de
  este archivo. Los commits anteriores no lo traen; la relación entre PR e
  historia está en los comentarios de cada tarjeta de sprint en Trello.

## 2. Ramas y pull requests

- `main`: versión entregable. `development`: integración.
- Una rama por cambio: `feature/<nombre>`, `fix/<nombre>`, `chore/<nombre>`,
  `docs/<nombre>`.
- Todo cambio entra a `development` por pull request y con el CI en verde.
- El pull request lo revisa el otro integrante antes del merge.
- Al cierre de cada corte, `development` se integra a `main` por pull request.

## 3. Calidad automática (CI)

`npm run check` desde la raíz. Es lo mismo que corre GitHub Actions
(`.github/workflows/ci.yml`) en cada PR y en cada push a `main` y `development`:

1. Typecheck de `packages/shared`, `apps/backend` y `apps/mobile`.
2. Lint (oxlint en el backend, `expo lint` en mobile).
3. Formato con Prettier (backend).
4. Tests unitarios con Jest (backend).

## 4. Código

- Backend con arquitectura hexagonal por módulo: `domain/` (entidad + puerto),
  `infrastructure/` (adaptador de Supabase), `service`, `view`, `controller`
  y `module`. Detalle en [docs/arquitectura-backend.md](docs/arquitectura-backend.md).
- Tipos compartidos entre apps, en `packages/shared` con Zod.
- camelCase para variables, funciones y nombres de archivo.
- Toda tabla nueva lleva RLS activo. Sin políticas, si solo la usa el backend.
- Errores de la API con Problem Details (RFC 9457) y códigos estables.
- Toda regla de negocio o código de error nuevo trae su `*.spec.ts`
  ([docs/testing.md](docs/testing.md)).

## 5. Definition of Ready

Una historia entra a un sprint cuando tiene:

- Formato "Como… quiero… para…".
- Criterios de aceptación verificables (CA-xx.y).
- Prioridad (Núcleo / Secundario) y responsable.
- Estimación.

## 6. Definition of Done

- Código integrado a la rama principal.
- Revisado por el otro integrante.
- Criterios de aceptación verificados.
- CI en verde, y tests de las reglas de negocio nuevas.

## 7. Tablero (Trello)

| Columna | WIP | Para llegar aquí |
|---|---|---|
| Backlog | Sin límite | Historias escritas con criterio de aceptación |
| Por hacer | 4 | Sprint planeado; historias priorizadas y estimadas |
| En progreso | 2 | Sprint en curso; cada historia tiene responsable y rama |
| En revisión | 2 | Pull requests abiertos, la app compila y el otro integrante revisa |
| Hecho | Sin límite | Cumple la Definition of Done |

Códigos: HU = historia de usuario · T = tarea técnica.
