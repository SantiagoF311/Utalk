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

Esto determina a qué panel de universidad tiene acceso el usuario, además
del panel general al que todos los usuarios verificados tienen acceso.
