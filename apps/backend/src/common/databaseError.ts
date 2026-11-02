import type { PostgrestError } from '@supabase/supabase-js';

// Códigos de Postgres que tiene sentido traducir a un error de la API en vez
// de un 500. Lista completa: https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = '23505';

// Choque contra una constraint `unique`: pasa cuando dos requests pasan el
// chequeo previo del service al mismo tiempo (ej. dos personas eligiendo el
// mismo username) y la base frena al segundo.
//
// `constraint` es obligatorio: una tabla suele tener más de una constraint
// única (como mínimo la primary key), y cada una significa algo distinto —
// en profiles, chocar con `profiles_pkey` es "este usuario ya tiene perfil",
// no "username tomado". PostgREST no expone el nombre de la constraint en un
// campo propio, solo dentro del mensaje de Postgres, así que se busca ahí.
export function isUniqueViolation(error: PostgrestError, constraint: string): boolean {
  return error.code === UNIQUE_VIOLATION && error.message.includes(`"${constraint}"`);
}
