import type { Panel, PostSort } from '@utalk/shared';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { useMyProfile, usePanels } from '@/hooks/queries';
import { deviceStorage, StorageKeys } from '@/lib/deviceStorage';

type FeedSelection = {
  // `undefined` mientras cargan los paneles o el perfil.
  panel: Panel | undefined;
  panels: Panel[];
  myPanelId: string | undefined;
  selectPanel: (panelId: string) => void;
  sort: PostSort;
  setSort: (sort: PostSort) => void;
  status: 'pending' | 'error' | 'success';
  error: Error | null;
  retry: () => void;
};

const FeedSelectionContext = createContext<FeedSelection | null>(null);

// Lo que el usuario está mirando: el panel elegido en el sidebar (que
// cambia Inicio, Comunidades y los visitados) y el orden del feed de Inicio.
// El panel se recuerda en el dispositivo; por defecto, el de tu universidad.
export function FeedSelectionProvider({ children }: { children: ReactNode }) {
  const me = useMyProfile();
  const panels = usePanels();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<PostSort>('hot');

  useEffect(() => {
    void deviceStorage.get(StorageKeys.selectedPanelId).then((id) => {
      if (id) setSelectedId((current) => current ?? id);
    });
  }, []);

  const list = panels.data ?? [];
  const myPanel = list.find(
    (panel) => panel.universityId !== null && panel.universityId === me.data?.universityId,
  );
  // Si el panel guardado ya no existe, se vuelve al tuyo (o al general).
  const panel =
    list.find((p) => p.id === selectedId) ?? myPanel ?? list.find((p) => p.universityId === null);

  const selectPanel = (panelId: string) => {
    setSelectedId(panelId);
    void deviceStorage.set(StorageKeys.selectedPanelId, panelId);
  };

  const status = me.isError || panels.isError ? 'error' : me.isPending || panels.isPending ? 'pending' : 'success';

  return (
    <FeedSelectionContext.Provider
      value={{
        panel,
        panels: list,
        myPanelId: myPanel?.id,
        selectPanel,
        sort,
        setSort,
        status,
        error: me.error ?? panels.error,
        retry: () => {
          void me.refetch();
          void panels.refetch();
        },
      }}>
      {children}
    </FeedSelectionContext.Provider>
  );
}

export function useFeedSelection(): FeedSelection {
  const context = useContext(FeedSelectionContext);
  if (!context) throw new Error('useFeedSelection fuera de FeedSelectionProvider');
  return context;
}
