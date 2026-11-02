# Autenticación y verificación de universidad

## Registro/login: código a correo institucional

Se usa **Supabase Auth** con login por código/magic link enviado al correo
institucional del usuario — feature nativa de Supabase, sin necesidad de
construir un flujo de autenticación custom (OTP, verificación de email,
manejo de tokens de sesión, todo lo maneja Supabase).

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
