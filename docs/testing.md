# Tests y CI

## Qué se testea hoy: tests unitarios, sin base de datos

Los tests del backend son **unitarios**: prueban la lógica (entidades,
services, guards, el filtro de errores) sin tocar Supabase. Corren en
segundos y no necesitan red, `.env` ni datos.

Funciona gracias a la arquitectura hexagonal (ver
[arquitectura-backend.md](./arquitectura-backend.md)): un service depende
del **puerto** (una interface), no de Supabase. En el test se le pasa un
**repositorio falso** que implementa esa interface en memoria.

| Qué | Cómo se prueba |
|---|---|
| Entidades (`domain/*.entity.ts`) | Directo: se crea la entidad y se llama al método (`panel.acceptsPostsFrom(...)`) |
| Services | `new XService(repositorioFalso, serviceFalso, ...)`, sin el módulo de Nest |
| Guards y el filtro de errores | Con un `ExecutionContext` / `ArgumentsHost` falso |

**Qué no cubren** los unitarios: lo que solo existe en Postgres
(triggers, constraints, permisos de `service_role`, joins de PostgREST).
Esos bugs (ej. el join ambiguo del autor, los grants faltantes) solo los
detecta un test de integración contra una base real — ver "Pendiente"
abajo.

## Dónde van y cómo se escriben

- Cada test va **junto al archivo que prueba**, con sufijo `.spec.ts`:
  `posts/posts.service.ts` → `posts/posts.service.spec.ts`.
- Los datos de prueba salen de
  [`src/testing/fixtures.ts`](../apps/backend/src/testing/fixtures.ts):
  builders (`makeProfile()`, `makePanel()`, `makePost()`...) que crean
  entidades válidas con valores por defecto, e `IDS` con UUID fijos y
  legibles. Cada test pisa solo lo que le importa:
  `makeProfile({ universityId: IDS.otherUniversity })`.
- El backend es ESM: `jest`, `describe`, `it` y `expect` se importan de
  `@jest/globals`.
- Los repositorios falsos se arman con `jest.fn<Puerto['metodo']>()`, así
  TypeScript verifica que el falso respete la firma del puerto — si el
  puerto cambia, el test no compila hasta actualizarlo.
- Se testea el **comportamiento** (qué devuelve, qué error lanza), no los
  detalles internos. Excepción deliberada: tests que fijan una
  optimización (ej. "crear un post no lo relee") para que nadie la
  deshaga sin darse cuenta.

Ejemplo mínimo:

```ts
import { describe, expect, it, jest } from '@jest/globals';
import { IDS, makeForum, makePanel, makeProfile } from '../../testing/fixtures.js';

it('rechaza postear en el panel de otra universidad', async () => {
  profiles.findById.mockResolvedValue(makeProfile({ universityId: IDS.otherUniversity }));

  await expect(service.create(input, IDS.beto)).rejects.toMatchObject({
    code: 'CANNOT_PUBLISH_IN_PANEL',
  });
  expect(repository.create).not.toHaveBeenCalled();
});
```

**Regla para código nuevo**: un módulo, regla de negocio o código de
error nuevo trae sus tests en el mismo PR.

## Antes de abrir un PR: `npm run check`

Desde la raíz:

```
npm run check
```

Corre, en orden: typecheck de `shared`, `backend` y `mobile`; lint de
backend y mobile; formato (Prettier) del backend; y los tests. Es lo mismo
que corre el CI. Para formatear: `npm run format -w apps/backend`.

## CI (GitHub Actions)

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre los mismos
pasos que `npm run check` en cada PR y en cada push a `main`/`development`,
en una máquina limpia (Linux, solo con lo que está en el repo). Detecta el
"en mi máquina funciona": archivos sin commitear, dependencias instaladas
a mano, un `.env` local.

**El resultado se ve en el PR, pero hoy no bloquea el merge**: el repo es
privado en una cuenta gratuita, y GitHub no aplica las reglas de rama ahí
(el ruleset de `development` que exige el check `check` está creado, pero
inactivo). Acuerdo del equipo: **no se mergea con ❌**. Se aplicaría solo
con GitHub Pro (gratis con el Student Developer Pack, usando una regla de
protección clásica) o si el repo pasa a público.

Si se renombra el job `check` en `ci.yml`, hay que actualizar el ruleset:
si no, queda esperando un check que nunca llega.

## Pendiente: tests de integración

Para cubrir triggers, constraints, permisos y joins hace falta correr
tests contra un Postgres real. La opción recomendada es **Supabase local en
Docker** (`supabase start`), no el proyecto en la nube: hoy hay un único
proyecto de Supabase, que es el que va a usar producción, y los tests crean
y borran datos. Implica agregar `supabase/config.toml` (con el Auth Hook
configurado) y descargar las imágenes de Docker la primera vez.
