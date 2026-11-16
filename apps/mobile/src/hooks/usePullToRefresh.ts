import { useState } from 'react';

// Estado del "tirar para refrescar" de una lista. El spinner se muestra solo
// cuando el usuario tiró la lista, no en cada recarga en segundo plano.
//
// Por qué no `refreshing={query.isRefetching}`: `isRefetching` se vuelve true
// en cualquier recarga (al volver a la pantalla, al invalidar la caché, al
// llegar un mensaje por Realtime). En iOS, prender el RefreshControl por
// código, sin que el usuario haya tirado, deja el spinner trabado arriba
// hasta que se vuelve a deslizar.
//
// Uso: <RefreshControl {...usePullToRefresh(() => query.refetch())} />
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return { refreshing, onRefresh };
}
