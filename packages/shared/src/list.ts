import { z } from 'zod';

// Toda respuesta que es una colección va envuelta en un objeto, aunque hoy no
// pagine: así se le puede agregar `nextCursor` (u otros metadatos) sin
// romper a los clientes. Las paginadas usan su propio schema con
// `nextCursor` (ej. postPageSchema).
export function listSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item) });
}

export interface List<T> {
  items: T[];
}
