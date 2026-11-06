# Autenticación y verificación de universidad

## Registro y login

Se usa **Supabase Auth** — sin construir un flujo de autenticación custom
(verificación de email, contraseñas, emisión de tokens de sesión: todo lo
maneja Supabase).

- **Registro** (desde el mobile, directo contra Supabase): correo
  institucional + contraseña (`signUp`) → Supabase envía un código al
  correo → el usuario lo ingresa (`verifyOtp`) y queda con sesión → elige
  su apodo con `POST /auth/complete-registration`, que crea el perfil.
  El Auth Hook rechaza el registro si el dominio del correo no es de una
  universidad soportada (ver abajo).
- **Login** (a través del backend): `POST /auth/login` con **usuario o
  correo** + contraseña. El backend resuelve el correo detrás del apodo,
  así el correo nunca sale del backend. Devuelve la sesión de Supabase
  (access token + refresh token).

## Verificación del token en cada request

El mobile manda el access token de Supabase (un JWT) en
`Authorization: Bearer …`, y el `AuthGuard` del backend lo valida en cada
request. Se verifica **localmente**: el proyecto firma los tokens con
claves asimétricas (ES256), así que el backend descarga una vez la clave
pública de Supabase (JWKS) y comprueba firma y vencimiento sin llamar a
Supabase (`auth.getClaims()`). Solo acepta tokens de sesión de usuario
(`role: authenticated`).

**Por qué local y no preguntarle a Supabase en cada request**
(`auth.getUser()`, lo que se hacía antes): esa llamada sumaba latencia de
red a todas las requests, hacía que la API entera dependiera de que
Supabase Auth respondiera, y consumía los límites de llamadas de su
servicio de Auth. Es además lo que recomienda Supabase desde que usa
claves asimétricas.

**Costo aceptado**: el backend no se entera de una sesión revocada. Si
alguien cierra sesión o se le borra la cuenta, su token sigue siendo
válido **hasta que vence** (1 h por defecto en Supabase). Si eso se
vuelve un problema (ej. banear usuarios al instante): acortar la duración
del token en Supabase, o revisar el estado del usuario solo en acciones
sensibles.

El apodo ("tipo Reddit") es un dato de perfil separado de la identidad
real — el correo se usa solo para verificar pertenencia institucional, no
se expone a otros usuarios.

## Asignación de universidad: por dominio de correo

La universidad a la que pertenece un usuario se infiere directamente del
dominio del correo institucional (ej. `@unal.edu.co` → Universidad
Nacional). No hace falta una tabla de verificación separada ni un proceso
de aprobación manual — el dominio ya es la señal de verificación.

Esto determina en qué panel de universidad puede **publicar** el usuario
(crear foros y posts), además del panel general donde publican todos los
usuarios verificados. No restringe lo que puede **ver**: cualquier
usuario lee, comenta y vota en los paneles de todas las universidades.
Ver la regla completa en [modelo-de-datos.md](./modelo-de-datos.md#forums).
