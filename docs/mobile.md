# Mobile (Expo / React Native)

App en `apps/mobile/`, con Expo Router (rutas por archivos). Habla con el
backend por HTTP (`src/lib/api.ts`) para todo, salvo el registro y la
sesión, que van directo contra Supabase Auth (ver [auth.md](./auth.md)).

## Estructura

```
src/
├── app/          # rutas de Expo Router: archivos finos que solo leen
│                 # parámetros y renderizan una pantalla de screens/
├── screens/      # una carpeta por pantalla (home, explore, panel, forum…)
├── components/   # piezas reutilizables (PostCard, FeedList, StateMessage…)
├── hooks/        # useSession, queries.ts (las queries de TanStack Query)…
└── lib/          # api.ts, queryClient.ts, queryKeys.ts, errorMessages.ts…
```

**Navegación**: dos pestañas, **Inicio** (el feed del panel de tu
universidad) y **Explorar** (todos los paneles: primero el general y el
tuyo, donde puedes publicar; después el resto, donde puedes leer, comentar
y votar). De ahí: panel (sus foros + el feed de todos ellos) → foro (su
feed). Panel y foro van en el stack raíz, fuera de las pestañas, con
header y botón atrás.

**Sesión**: toda la API exige sesión, así que las pantallas que la usan se
envuelven en `<RequireSession>`: muestra "Iniciar sesión / Crear cuenta"
si no hay sesión. `useRequireProfile` (en el layout raíz) manda a
completar el perfil si hay sesión pero todavía no se eligió apodo.

## Datos del servidor: TanStack Query

Para todo lo que viene de la API se usa **TanStack Query**
(`@tanstack/react-query`). No reemplaza a `api.ts` (que sigue siendo quien
hace los requests): decide cuándo llamarlo y qué hacer con el resultado.

**Por qué, y no `fetch` + `useState` a mano**: cada pantalla necesitaría
programar a mano estados de carga y error, caché, paginación, reintentos y
refresco — mucho código repetido y fácil de dejar inconsistente. En
particular, dos cosas que la app necesita son las más propensas a errores
escritas a mano, y TanStack Query las resuelve:

- **Scroll infinito con cursor**: `useInfiniteQuery` con
  `getNextPageParam: (page) => page.nextCursor` encaja directo con el
  `{ items, nextCursor }` del backend.
- **Voto optimista** (llega con la rama de interacción): la flecha cambia
  al instante y se revierte sola si el servidor falla.

**Configuración** (`src/lib/queryClient.ts`):

- `staleTime` 30 s: volver a una pantalla muestra los datos al instante
  sin pedirlos de nuevo (los paneles, que casi no cambian, 10 min).
- No reintenta errores 4xx (sin permiso, no existe, validación: fallarían
  igual); sí los de red o 5xx, hasta 2 veces.
- Al volver la app a primer plano refresca lo visible (`focusManager` con
  `AppState`: en React Native no hay "foco de ventana").
- Al cerrar sesión se vacía la caché (`queryClient.clear()` en el layout
  raíz), para que otra cuenta en el mismo dispositivo no vea datos de la
  anterior (ej. "mi voto").

**Claves de la caché**: todas en `src/lib/queryKeys.ts`, para que invalidar
(ej. refrescar el feed después de postear) use exactamente la misma clave
que la query. Las queries viven en `src/hooks/queries.ts`.

**No confundir con la caché del backend**: esta caché vive en el celular
de cada usuario y ahorra requests al backend. Una caché del servidor
(Redis) sería compartida entre usuarios y ahorraría consultas a Postgres —
hoy no existe ni hace falta (ver [datos-y-trending.md](./datos-y-trending.md)
y [backend-y-colas.md](./backend-y-colas.md)). Son capas independientes.

## Errores

`api.ts` convierte las respuestas de error (Problem Details, ver
[observabilidad.md](./observabilidad.md)) en `ApiError`, con `status`,
`code` y `fieldErrors`. La app decide **siempre por `code`**, nunca por el
texto: `src/lib/errorMessages.ts` traduce cada `code` a un mensaje en
español para el usuario (el `detail` del backend es técnico y en inglés,
nunca se muestra).

## Variables de entorno

En `apps/mobile/.env` (plantilla: `apps/mobile/.env.example`):
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y
`EXPO_PUBLIC_API_URL`. Todo lo `EXPO_PUBLIC_*` queda dentro de la app
instalada y cualquiera puede leerlo: **nunca** va una clave secreta.

## Convenciones

- Archivos y carpetas en **camelCase** (`postCard.tsx`, `useTheme.ts`,
  `screens/completeProfile/`), como pide el `CLAUDE.md` para todo el
  monorepo. Los que vinieron en kebab-case con la plantilla de Expo ya se
  renombraron.
- Las rutas de `app/` son la excepción: su nombre es la URL
  (`complete-profile.tsx` → `/complete-profile`, `panel/[panelId].tsx`).
- Estilos con `StyleSheet` y los tokens de `constants/theme.ts`
  (`Colors`, `Spacing`), con `ThemedText` / `ThemedView` para modo claro y
  oscuro.

## Pendiente

- **Marca**: lo que queda de la plantilla de Expo sigue siendo su marca —
  la animación de arranque (`AnimatedSplashOverlay`, en
  `components/animatedIcon.tsx`) muestra el logo de Expo, y el ícono de
  la app y la pantalla de carga (`app.json`) son los genéricos. Hay que
  reemplazar esas imágenes cuando exista un logo de UTalk.
- **Tests del mobile**: no hay todavía (ni Jest configurado en el
  workspace). El CI sí corre su typecheck y lint.
- **Rutas tipadas**: Expo Router genera los tipos de las rutas en
  `.expo/types/router.d.ts` al correr `expo start`. Si después de crear
  una ruta nueva el typecheck dice que la ruta no existe, levantar Expo una
  vez los regenera.
