// Para botones que se pueden tocar varias veces seguidas (votar, unirse): un
// pedido por toque no sirve, porque las respuestas (y los pedidos mismos)
// pueden llegar en otro orden y el estado final quedaría mal. En cambio:
//
// 1. Quien llama cambia la caché al instante (lo que se ve).
// 2. Recién cuando pasa SETTLE_DELAY_MS sin toques se manda UN pedido con el
//    estado final; si quedó igual a lo que confirmó el servidor (ej. dos
//    toques que se anulan), no se manda nada.
// 3. Los pedidos de una misma clave van en fila, y la respuesta solo se
//    aplica si nadie volvió a tocar mientras viajaba.
const SETTLE_DELAY_MS = 500;

type Sync = {
  // Lo último que confirmó el servidor.
  confirmed: unknown;
  timer: ReturnType<typeof setTimeout> | null;
  queue: Promise<void>;
};

const syncs = new Map<string, Sync>();

type SettledSyncOptions<T> = {
  // Lo que había antes de este toque (solo cuenta si no hay nada pendiente
  // para esta clave: en ese caso es lo que dijo el servidor).
  before: T;
  // Lo que muestra la caché ahora, es decir, lo último que se tocó.
  current: () => T;
  // Manda el estado final; devuelve lo que confirmó el servidor.
  send: (desired: T) => Promise<T>;
  // La respuesta llegó y nadie volvió a tocar: se puede aplicar.
  onSettled?: (confirmed: T) => void;
  // Falló: no se sabe en qué quedó, hay que volver a pedir el estado real.
  onError: () => void;
};

// Llamar después de cambiar la caché por el toque.
export function settleLater<T>(key: string, options: SettledSyncOptions<T>) {
  const sync = syncs.get(key) ?? { confirmed: options.before, timer: null, queue: Promise.resolve() };
  syncs.set(key, sync);

  if (sync.timer) clearTimeout(sync.timer);
  sync.timer = setTimeout(() => {
    sync.timer = null;
    sync.queue = sync.queue.then(async () => {
      const desired = options.current();
      try {
        if (desired !== sync.confirmed) {
          const confirmed = await options.send(desired);
          sync.confirmed = confirmed;
          if (!sync.timer && options.current() === confirmed) options.onSettled?.(confirmed);
        }
      } catch {
        options.onError();
      } finally {
        // Sin toques pendientes, se olvida: la caché ya tiene el estado real,
        // y la próxima vez se parte de ahí (también si entra otra cuenta).
        if (!sync.timer) syncs.delete(key);
      }
    });
  }, SETTLE_DELAY_MS);
}
