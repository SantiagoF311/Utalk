import { useSyncExternalStore } from 'react';

// Ids de posts y comentarios reportados que el usuario eligió ver igual. Es
// compartido (no estado de cada tarjeta) para que mostrarlo en el feed lo
// muestre también en el detalle, y al revés. Solo vive mientras la app está
// abierta: al volver a abrirla, lo reportado aparece oculto de nuevo.
const revealed = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setRevealed(id: string, value: boolean) {
  if (value) revealed.add(id);
  else revealed.delete(id);
  listeners.forEach((listener) => listener());
}

// Al cerrar sesión, para que otra cuenta no herede lo que la anterior mostró.
export function clearRevealedReports() {
  revealed.clear();
  listeners.forEach((listener) => listener());
}

export function useRevealedReport(id: string): [boolean, (value: boolean) => void] {
  // El tercer argumento es para el render estático de la web: ahí no se
  // mostró nada todavía.
  const isRevealed = useSyncExternalStore(
    subscribe,
    () => revealed.has(id),
    () => false,
  );
  return [isRevealed, (value) => setRevealed(id, value)];
}
