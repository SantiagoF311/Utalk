import type { Panel } from '@utalk/shared';

import { useMyProfile, usePanels } from '@/hooks/queries';

// Los paneles desde el punto de vista del usuario: el de su universidad y el
// general, que son donde puede publicar (ver PanelEntity.acceptsPostsFrom en
// el backend). Los demás se pueden leer, comentar y votar.
export function useMyPanels() {
  const me = useMyProfile();
  const panels = usePanels();

  const list = panels.data ?? [];
  const myPanel = list.find(
    (panel) => panel.universityId !== null && panel.universityId === me.data?.universityId,
  );
  const generalPanel = list.find((panel) => panel.universityId === null);

  return {
    panels: list,
    myPanel,
    generalPanel,
    // Paneles donde puede publicar, el suyo primero.
    publishable: [myPanel, generalPanel].filter((panel): panel is Panel => panel !== undefined),
    status: (me.isError || panels.isError
      ? 'error'
      : me.isPending || panels.isPending
        ? 'pending'
        : 'success') as 'pending' | 'error' | 'success',
    error: me.error ?? panels.error,
    retry: () => {
      void me.refetch();
      void panels.refetch();
    },
  };
}
