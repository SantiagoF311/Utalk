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

**Sesión: dos zonas con rutas protegidas.** Toda la API exige sesión, así
que la app se divide en dos zonas con `Stack.Protected` de Expo Router, en
el layout raíz (`app/_layout.tsx`):

| Zona | Pantallas |
|---|---|
| Sin sesión | `welcome` (presenta la app, con "Iniciar sesión / Crear cuenta"), `login` |
| Con sesión | las pestañas, `panel`, `forum`, `complete-profile` |
| Ambas | `register` |

Una pantalla solo existe si el guard de su zona es true: sin sesión no se
puede llegar a las pestañas (ni con un link), y al iniciar o cerrar sesión
la app redirige sola a la primera pantalla disponible de la otra zona. Por
eso el login no navega al terminar, y **el orden de declaración importa**:
la primera pantalla de cada zona es a donde se cae (`welcome` y `(tabs)`).
Desde SDK 58 existe `redirectTo` para indicar el destino explícitamente;
no se usa porque el orden ya da el resultado buscado.

`register` queda fuera de las dos zonas porque su flujo cruza el momento en
que aparece la sesión: después de verificar el código ya hay sesión, pero
todavía falta elegir el apodo; protegido, se cerraría a la mitad.

La sesión la provee un único `SessionProvider` (`hooks/useSession.tsx`),
que es el único lugar que se suscribe a los cambios de sesión de Supabase
(y vacía la caché al cerrar sesión); el resto la lee con `useSession()`.
Por eso el layout raíz pone los proveedores afuera y la navegación en un
componente adentro (`RootNavigator`), que ya puede leer el contexto.

Mientras se lee la sesión guardada en el dispositivo, la pantalla de carga
nativa sigue visible, para no mostrar un instante la zona equivocada.
`useRequireProfile` manda a completar el perfil si hay sesión pero todavía
no se eligió apodo.

Las rutas protegidas son solo navegación del cliente: la seguridad real la
da el backend, que exige el token en cada request.

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
- **Versiones de los paquetes de Expo**: tienen que ser las que Expo probó
  para el SDK instalado. `npx expo install --check` (desde `apps/mobile`)
  dice cuáles están desalineadas; se instalan **desde la raíz** con
  `npm install <paquete>@<versión> -w apps/mobile`, no con
  `npx expo install --fix` (que correría la instalación dentro del
  workspace). Los paquetes que Expo pide con versión exacta (`react`,
  `react-native`, `react-native-reanimated`, `react-native-worklets`) se
  instalan con `--save-exact`.

## Actualizar el SDK de Expo

El proyecto está en **SDK 58** (React Native 0.88). Expo Go en iOS solo
soporta el último SDK, así que quedarse atrás impide probar en un iPhone.
Pasos, de a un SDK por vez, leyendo antes las notas de la versión
(expo.dev/changelog):

1. `npm install expo@~<versión> -w apps/mobile` desde la raíz.
2. `npx expo install --check` en `apps/mobile` → instalar desde la raíz
   las versiones que pide (ver Convenciones).
3. `npx expo-doctor@latest` en `apps/mobile` tiene que pasar entero.
4. `npm run check` y `npx expo export --platform web` en `apps/mobile`.

**Copias duplicadas en el monorepo**: al actualizar de a poco, npm suele
dejar copias viejas en la raíz (la versión nueva queda anidada en
`apps/mobile/node_modules` y los paquetes de la raíz siguen viendo la
vieja). `expo-doctor` lo detecta ("duplicate native module dependencies").
Solución: quitar del `package-lock.json` solo las entradas de esos paquetes
y correr `npm install` para que los vuelva a resolver. No usar
`npm dedupe`: reorganiza todo el monorepo, incluido el backend, y choca con
sus dependencias de tests.

**`overrides` en el `package.json` raíz**: `react-native-worklets` está
forzado a la versión exacta que pide el SDK, porque otros paquetes aceptan
un rango (`0.13.x`) y npm elegía la más alta, dejando dos copias. Al
cambiar de SDK, actualizar ese valor a la versión que pida
`npx expo install --check`.
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
