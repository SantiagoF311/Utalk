# Mobile (Expo / React Native)

App en `apps/mobile/`, con Expo Router (rutas por archivos). Habla con el
backend por HTTP (`src/lib/api.ts`) para todo, salvo el registro y la
sesión, que van directo contra Supabase Auth (ver [auth.md](./auth.md)).

## Estructura

```
src/
├── app/          # rutas de Expo Router: archivos finos que solo leen
│                 # parámetros y renderizan una pantalla de screens/
├── screens/      # una carpeta por pantalla (home, communities, community, user…)
├── components/   # piezas reutilizables (PostCard, FeedList, StateMessage…)
├── hooks/        # useSession, queries.ts (las queries de TanStack Query)…
└── lib/          # api.ts, queryClient.ts, queryKeys.ts, errorMessages.ts…
```

## Navegación

Organizada como Reddit: un **sidebar** (☰) y una **barra de abajo**.

```
app/
├── (drawer)/_layout.tsx         sidebar: Drawer de Expo Router con contenido propio
│   └── (tabs)/_layout.tsx       barra de abajo propia (components/tabBar.tsx)
│       ├── index                Inicio
│       ├── communities          Comunidades
│       ├── chats                Chats y Solicitudes
│       └── profile              Perfil (con su propia barra: solo ⚙️ Ajustes)
├── community/[communityId]      ┐ con su propia barra de color (?sort= opcional)
├── post/[postId]                │ stack raíz, encima de todo, con botón atrás
├── user/[userId]                │
├── settings                     │
├── change-username              │ desde Ajustes
├── chat/[conversationId]        │ una conversación
├── chat/new                     │ primer mensaje a alguien: desde su perfil (?userId=&username=)
├── blocked-users                │ Bloqueados: desde Ajustes
├── my-reports                   │ Mis reportes: desde Ajustes
├── moderation                   │ cola de moderación: desde el sidebar o Ajustes (solo moderadores y admins)
├── search                       │ buscar: desde Inicio (?panelId=) o desde una comunidad (?communityId=)
├── compose                      │ publicar: modal del "+" de Inicio o de una comunidad (?communityId=, ?title=)
├── create-community             │ crear comunidad: modal desde el sidebar (?panelId=)
└── report                       ┘ reportar: modal desde el "···" de lo ajeno (?postId=…[&commentId=…])
```

**El panel elegido manda.** El sidebar (`components/sidebar.tsx`) tiene
arriba un selector de panel: el de tu universidad, el general y el resto
(los de otras universidades se pueden leer, comentar y votar, ver
[modelo-de-datos.md](./modelo-de-datos.md)). Todo lo demás es de ese panel:

- **Popular / Reciente** en el sidebar: el orden del feed de Inicio. Inicio
  no tiene selector de orden propio, para no tener dos controles de lo
  mismo.
- **Inicio**: el feed del panel elegido. Arriba, como en Reddit, una barra
  "Buscar en <panel>" siempre visible (abre la búsqueda, ver
  [busqueda.md](./busqueda.md)), que además dice en qué panel estás, y a su
  lado el **"+" para publicar**; el panel se cambia desde el ☰.
- **Comunidades**: las del panel elegido, con chips por tema y un buscador
  (filtran en el celular; el buscador sin tildes ni mayúsculas). Cada
  tarjeta tiene descripción, miembros y "Unirse / Te uniste".
- **"+ Crear una comunidad"** en el sidebar: solo si el panel elegido es el
  tuyo o el general (donde se puede publicar).
- **Visitadas recientemente** y **Tus comunidades** (a las que te uniste) en
  el sidebar, del panel elegido.

**Chats** (diseño completo en [chat-realtime.md](./chat-realtime.md)):

- La pestaña **Chats** separa **Chats** y **Solicitudes** (te escribió
  alguien y no respondiste). Las que mandaste y esperan respuesta van en
  Chats, marcadas "Esperando que acepte". El ícono de la pestaña lleva el
  total de mensajes sin leer de tus chats (las solicitudes no cuentan).
- Para escribirle a alguien: su perfil → **Enviar mensaje** (`chat/new`).
  Si ya hablaron, abre esa conversación.
- Los mensajes se dibujan con `components/messageBubble.tsx` (en la
  conversación y en el primer mensaje): hora, "Visto" en el último propio
  leído, relojito si tarda en confirmarse y "No se envió" si falló.
- En una conversación (`screens/conversation`), lo de abajo depende del
  estado: solicitud recibida (aviso, Bloquear y el campo para responder),
  solicitud enviada (solo el aviso de espera) o aceptada (el campo para
  escribir). El "···" tiene Ver perfil y Bloquear.
- **Bloquear** desde el perfil o la conversación (`components/blockUserSheet.tsx`
  confirma); desbloquear desde el perfil o **Ajustes → Bloqueados**.

**Reportes y moderación** (ver la sección Moderación de
[modelo-de-datos.md](./modelo-de-datos.md#moderación)):

- Al reportar, la confirmación muestra el **número de caso**. En **Ajustes →
  Mis reportes** (`screens/myReports`) está cada reporte con su estado: en
  revisión, se eliminó o sin acción. Tocarlo abre la publicación, salvo que
  se haya eliminado.
- **Moderación** (`screens/moderation`) aparece en el sidebar y en Ajustes
  solo si `GET /moderation/scope` dice que el usuario es admin o modera
  alguna comunidad (`useModerationScope`). Es la cola, con lo más grave
  primero: una tarjeta por contenido con sus motivos, los detalles y la
  cantidad de reportes, y los botones **Eliminar** (con confirmación) y
  **Dejar**. Si modera más de una comunidad, arriba se filtra por cada una.
- Un comentario eliminado por moderación se ve como "Un moderador eliminó
  este comentario"; un post eliminado no aparece, y abrirlo desde un enlace
  viejo da "Un moderador eliminó esta publicación" (`POST_REMOVED`).
- Los textos de los motivos y estados están en `lib/reportLabels.ts`, que
  usan el formulario de reportar, la cola y "Mis reportes".

**Tarjetas de post** (`components/postCard.tsx`), como Reddit:

| Dónde | Cabecera |
|---|---|
| Feed de un panel (se mezclan comunidades) | avatar · `c/<comunidad>` · hace cuánto (tocar la comunidad la abre) |
| Feed de una comunidad | `u/<apodo>` · hace cuánto |
| Detalle del post | avatar y `c/<comunidad>` arriba; `u/<apodo>` · universidad · hace cuánto debajo |

El panel elegido y su orden viven en un contexto (`hooks/useFeedSelection.tsx`),
que el layout `(drawer)` pone alrededor del sidebar y las pestañas.

**Una comunidad** tiene su propia barra arriba, como la de Reddit: una
franja de color con botones redondos (← | 🔍 + ···). El 🔍 busca dentro de
la comunidad, el + publica en ella (solo si es de un panel donde se puede) y
el ··· tiene "Unirse / Salirse". Por eso esa ruta no usa la cabecera nativa
del stack. Debajo, su cabecera (`c/<slug>`, miembros, tema, botón y
descripción) y su feed, con su propio orden (Popular, Reciente, Más
votados) en un menú que se abre desde abajo al tocar "POPULAR ▾"
(`components/sortMenu.tsx`).

**Perfiles**: tocar `u/apodo` en un post o comentario abre su perfil (si es
el tuyo, tu pestaña Perfil; `hooks/useOpenProfile.ts`). El propio y el ajeno
son el mismo componente (`components/profileView.tsx`, diseño 4a): apodo,
universidad, antigüedad, contadores (votos · publicaciones · comentarios) y
pestañas con sus publicaciones (el feed por autor; cada tarjeta pide su
comunidad, porque en un perfil se mezclan comunidades de varios paneles) y
sus comentarios ("en «título»", abren el post). Si el perfil es privado y no
es el tuyo, solo la cabecera y "Este perfil es privado" (el backend no manda
contadores ni deja pedir el historial; ver
[modelo-de-datos.md](./modelo-de-datos.md)).

**Ajustes** (⚙️ del perfil): tu apodo con "Cambiar" (o desde cuándo se
puede, si lo cambiaste hace menos de 30 días), el interruptor "Perfil
privado", la cuenta, el tema y cerrar sesión. "Cambiar apodo" valida
mientras se escribe con el mismo chequeo que el registro. Al cambiarlo se
vuelven a pedir los feeds, posts y comentarios, porque todos muestran el
apodo.

**La barra de abajo** tiene 4 pestañas (Inicio · Comunidades · Chats ·
Perfil); publicar no va ahí sino en el "+" de arriba, como en Reddit. Es
propia (`components/tabBar.tsx`) y no la de Expo Router porque es la que
decide el orden visual de las pestañas (ver abajo).

**El orden de las pestañas en el layout no es el visual.** Expo Router arma
el estado inicial con las pestañas en su orden por defecto (`index`
primero, después por largo del nombre); si el layout las declara en otro
orden, al montar despacha `ROUTE_NAMES_CHANGED` y en desarrollo avisa que
nadie lo manejó. Por eso `(tabs)/_layout.tsx` las declara en ese orden, y
el orden visual lo decide `TabBar`. Al agregar una pestaña, ubicarla según
esa regla.

**Aviso conocido en desarrollo**: al arrancar sale `The action
'CLOSE_DRAWER' was not handled by any navigator`. Lo dispara la librería del
drawer (`react-native-drawer-layout`) al montar, antes de que Expo Router
registre el navegador; no afecta nada y no existe en producción. Se podría
evitar usando el componente `Drawer` suelto en vez del navegador, pero
habría que programar a mano el botón atrás de Android que cierra el
sidebar; se prefirió seguir el camino oficial. Los avisos de Reanimated
("Dependencies should only be used on the web") también vienen de esa
librería.

**Guardado en el dispositivo** (`lib/deviceStorage.ts`, AsyncStorage). No
son datos importantes: si el almacenamiento falla, la app sigue sin
recordarlos.

| Dato | Al cerrar sesión |
|---|---|
| Panel elegido, comunidades visitadas, búsquedas recientes | **Se borran** (junto con la caché): otra cuenta en el mismo celular no debe ver qué visitó la anterior |
| Tema (Ajustes) | Se queda: es del dispositivo, no de la cuenta |

**Tema** (Ajustes, desde el ⚙️ del perfil): según el sistema, claro u
oscuro (`hooks/useThemePreference.tsx`). Se aplica en `useColorScheme`, que
es lo que leen todos los colores; en iOS y Android además con
`Appearance.setColorScheme`, para que también cambie lo que dibuja el
sistema (teclado, alertas). En la web eso no existe y basta con el hook.

## Comentarios

El árbol llega armado del backend (`replies` anidadas) y
se dibuja recursivo (`components/commentItem.tsx`). La sangría deja de
crecer a partir del 4.º nivel para no dejar el texto sin ancho en un
celular. Tocar la cabecera de un comentario colapsa o expande su hilo. Un
comentario borrado se ve como "[eliminado]" y conserva sus respuestas.

## Sesión

**Dos zonas con rutas protegidas.** Toda la API exige sesión, así
que la app se divide en dos zonas con `Stack.Protected` de Expo Router, en
el layout raíz (`app/_layout.tsx`):

| Zona | Pantallas |
|---|---|
| Sin sesión | `welcome` (qué es UTalk y su anonimato, con "Empezar" e "Inicia sesión"), `login` |
| Con sesión | `(drawer)` (sidebar y pestañas), `community`, `post`, `user`, `compose`, `complete-profile` |
| Ambas | `register` |

Una pantalla solo existe si el guard de su zona es true: sin sesión no se
puede llegar a las pestañas (ni con un link), y al iniciar o cerrar sesión
la app redirige sola a la primera pantalla disponible de la otra zona. Por
eso el login no navega al terminar, y **el orden de declaración importa**:
la primera pantalla de cada zona es a donde se cae (`welcome` y `(drawer)`).
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
- **Voto optimista**: la flecha cambia al instante y se revierte sola si el
  servidor falla (ver "Escrituras" abajo).

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

**Pre-llenar la caché al navegar**: al tocar un post del feed, el post (que
el feed ya trae completo) se guarda con `setQueryData` en la clave del
detalle antes de navegar. Así el detalle se muestra al instante, sin
pantalla de carga, y solo se piden los comentarios.

### Escrituras (votar, publicar, comentar, borrar, reportar)

Viven en `src/hooks/mutations.ts`, con `useMutation`.

**Un post vive en varias cachés a la vez.** Cada feed donde aparece es una
entrada distinta (`['feed', { panelId }, 'hot']`, el mismo panel en
`'new'`, el feed de su comunidad…), y su detalle es otra (`['post', id]`):
son copias del mismo post. Por eso los cambios pasan por
`updatePostEverywhere` / `removePostEverywhere`, que lo cambian en todas
las cachés que empiezan con `'feed'` y en la del detalle. Si se actualizara
una sola, al volver al feed se vería el voto viejo hasta el próximo
refresco.

| Acción | Qué hace con la caché |
|---|---|
| Votar post o comentario | **Optimista y "al soltar"** (ver abajo): flecha y puntaje cambian al instante en todas las copias (feeds —incluido el del perfil del autor—, detalle, árbol, lista de comentarios del perfil) y en los votos recibidos del perfil del autor; al servidor va solo el voto final. Si falla, se vuelve a pedir todo eso |
| Unirse / salirse de una comunidad | Igual que votar: botón y contador cambian al instante en la lista del panel y en el detalle; al confirmar el servidor se aplica el contador real |
| Crear comunidad | Guarda la comunidad nueva en su detalle e invalida la lista del panel |
| Publicar | Guarda el post nuevo en su detalle (se abre al instante) e invalida los feeds |
| Comentar o responder | Invalida el árbol de comentarios y sube `commentCount` en todas las copias del post |
| Borrar post | Lo saca de todos los feeds y borra su detalle y sus comentarios de la caché |
| Borrar comentario | Invalida el árbol. El contador no cambia: un comentario borrado queda como "[eliminado]" y sigue contando |
| Reportar | **No optimista** (la confirmación se muestra cuando el servidor respondió). Marca `reportedByMe` en todas las copias del post o en el comentario del árbol, y la app lo muestra oculto con "Ver igual". Al verlo, una franja "Reportaste esta publicación · Ocultar" permite esconderlo de nuevo. Qué se eligió ver se recuerda por id (`hooks/useRevealedReport.ts`), así que vale igual en el feed y en el detalle; dura mientras la app está abierta y se borra al cerrar sesión. Invalida "Mis reportes" |
| Mandar un mensaje | **Optimista**, como WhatsApp: aparece al instante con un id provisional y se reemplaza por el real cuando el servidor lo confirma. Si tarda más de 1 s, lleva un relojito junto a la hora; si el servidor lo rechaza (bloqueo, solicitud sin aceptar, sin conexión), queda "No se envió: motivo · Toca para reintentar". Ver "Mensajes optimistas" abajo |
| Primer mensaje a alguien | También optimista, en la pantalla `chat/new`. Cuando el servidor crea la conversación, se guarda el mensaje en su caché (`seedFirstMessage`) y se reemplaza la pantalla por la de la conversación, que lo muestra sin cargar |
| Abrir una conversación con no leídos | El contador baja al instante y se avisa a la API (`POST /conversations/:id/read`); el otro ve "Visto" por Realtime. En una solicitud recibida no se hace |
| Bloquear / desbloquear | Invalida la lista de bloqueados, la de chats y la conversación con esa persona |
| Resolver un caso (moderación) | **No optimista.** Al eliminar un post, lo saca de todos los feeds como "Borrar post"; al eliminar un comentario, invalida el árbol de su post. Siempre vuelve a pedir la cola, también si falló (otro moderador pudo haberse adelantado: `NO_PENDING_REPORTS`) |

**Tocar la flecha que ya está marcada quita el voto** (`DELETE
/votes/...`); la otra lo cambia (`PUT`, que reemplaza el voto anterior).
La regla está en `nextVote`, y se aplica sobre lo que muestra la caché (lo
último que se tocó), no sobre una copia vieja.

**Botones que se tocan varias veces seguidas** (votar, unirse) no mandan un
pedido por toque: las respuestas, y los pedidos mismos, pueden llegar en
otro orden, y el botón saltaba o terminaba en un estado distinto del último
toque. `lib/settledSync.ts` (`settleLater`) lo resuelve así:

1. Cada toque cambia la caché al instante.
2. Recién cuando pasa medio segundo sin toques se manda **un** pedido con el
   estado final; si quedó igual a lo que confirmó el servidor (ej. dos
   toques que se anulan), no se manda nada.
3. Los pedidos de un mismo botón van en fila, y una respuesta solo se aplica
   si nadie volvió a tocar mientras viajaba. Si falla, se vuelve a pedir el
   estado real.

Un botón nuevo de ese tipo (ej. seguir a alguien) debería usar lo mismo.

**Mensajes optimistas: un mensaje confirmado llega dos veces.** Al mandar
un mensaje, el confirmado llega por dos caminos y en cualquier orden: la
respuesta de la API y Realtime (Supabase avisa a los dos participantes,
también a quien lo mandó). `lib/chatCache.ts` hace que siempre quede uno
solo:

- Llega la respuesta de la API (`confirmPendingMessage`): reemplaza al
  provisional, o solo lo saca si Realtime ya había traído el real.
- Llega por Realtime (`addMessageToCache`): si ya está, no hace nada; si hay
  uno propio todavía sin confirmar con el mismo texto, lo reemplaza (el más
  viejo, por si se mandó dos veces lo mismo); si no, es nuevo (del otro, o
  propio mandado desde otro dispositivo).

**"Tirar para refrescar" solo al deslizar.** Las listas usan
`hooks/usePullToRefresh.ts`, nunca `refreshing={query.isRefetching}`:
`isRefetching` se prende en cualquier recarga en segundo plano (al volver a
la pantalla, al invalidar la caché, al llegar un mensaje por Realtime), y en
iOS prender el `RefreshControl` por código sin que el usuario haya tirado
deja el spinner trabado arriba hasta volver a deslizar. Con el hook, el
spinner aparece solo cuando el usuario tira la lista y se apaga cuando
termina esa recarga.

**Lo que llega por Realtime también pasa por la caché.** El chat es lo
único que el mobile lee directo de Supabase: `hooks/useChatRealtime.ts`
(montado en el layout del drawer mientras hay sesión) recibe los mensajes
nuevos, los "Visto" y las solicitudes aceptadas, y los aplica a las mismas
cachés que usa TanStack Query (`lib/chatCache.ts`). Así la pantalla no
distingue si un mensaje vino de la API o de Realtime. "Escribiendo…" no
pasa por la caché: es estado local de la pantalla
(`hooks/useTypingIndicator.ts`).

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

**`EXPO_PUBLIC_API_URL` en un celular**: en el celular, `localhost` es el
propio celular, no el computador con el backend. Por eso, **solo en
desarrollo y fuera de la web**, `src/lib/apiUrl.ts` reemplaza `localhost`
por la IP del computador que sirve la app (la que usa Metro, que Expo
expone en `Constants.expoConfig.hostUri`). Con `localhost:3000` en el
`.env` alcanza para probar en el navegador y en un celular con Expo Go
(misma red WiFi). En producción la URL se usa tal cual. Si igual no
conecta, revisar que el backend esté corriendo y que el firewall de
Windows permita a Node.js en redes privadas.

**Las variables se incorporan al compilar**: después de cambiar el `.env`
hay que reiniciar Expo limpiando la caché (`npm run mobile -- --clear`).

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
  oscuro. Paleta del diseño: azul `primary` para botones, enlaces y lo
  seleccionado, `primarySoft` para chips; tarjetas con borde en vez de
  sombra. El modo oscuro es como el de Reddit: grises neutros casi negros,
  sin tinte azul.
- **Íconos**: con `components/icon.tsx` (`<Icon name="search" />`), que
  tiene cada ícono por nombre propio. Detrás usa `SymbolView` de
  `expo-symbols`, siempre con las tres claves: `ios` (SF Symbols),
  `android` y `web` (las dos Material Symbols, el mismo nombre). Sin `web`,
  en el navegador el ícono no se ve — grave si es un botón, como el ojo de
  la contraseña. Un ícono nuevo se agrega al mapa de `icon.tsx`.

## Pendiente

- **Marca**: lo que queda de la plantilla de Expo sigue siendo su marca —
  la animación de arranque (`AnimatedSplashOverlay`, en
  `components/animatedIcon.tsx`) muestra el logo de Expo, y el ícono de
  la app y la pantalla de carga (`app.json`) son los genéricos. Hay que
  reemplazar esas imágenes cuando exista un logo de UTalk. Dentro de la
  app, la bienvenida y el login usan una marca provisional
  (`components/logo.tsx`, dos globos de conversación) que también se
  reemplaza.
- **Tests del mobile**: no hay todavía (ni Jest configurado en el
  workspace). El CI sí corre su typecheck y lint.
- **Rutas tipadas**: Expo Router genera los tipos de las rutas en
  `.expo/types/router.d.ts` al correr `expo start`. Si después de crear
  una ruta nueva el typecheck dice que la ruta no existe, levantar Expo una
  vez los regenera.
