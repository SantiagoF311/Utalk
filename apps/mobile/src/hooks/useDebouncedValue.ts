import { useEffect, useState } from 'react';

// El valor, pero recién cuando dejó de cambiar por `delayMs` (ej. buscar
// mientras se escribe sin mandar un request por cada letra).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
