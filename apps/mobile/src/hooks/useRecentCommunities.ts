import type { Community } from '@utalk/shared';
import { useQuery } from '@tanstack/react-query';

import { deviceStorage, StorageKeys } from '@/lib/deviceStorage';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

export type RecentCommunity = Pick<Community, 'id' | 'name' | 'slug' | 'panelId'>;

const MAX_RECENT = 10;

async function readRecent(): Promise<RecentCommunity[]> {
  const raw = await deviceStorage.get(StorageKeys.recentCommunities);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentCommunity[];
  } catch {
    return [];
  }
}

// Comunidades que abriste hace poco, como el "visitado recientemente" de
// Reddit. Se guardan solo en el dispositivo: nadie más las ve. Van por
// TanStack Query (con la caché como única fuente) para que el sidebar se
// actualice solo al visitar una.
export function useRecentCommunities(panelId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recentCommunities,
    queryFn: readRecent,
    staleTime: Infinity,
    select: (list) => list.filter((community) => community.panelId === panelId).slice(0, 5),
  });
}

export async function recordCommunityVisit(community: RecentCommunity): Promise<void> {
  const current = queryClient.getQueryData<RecentCommunity[]>(queryKeys.recentCommunities) ?? (await readRecent());
  const { id, name, slug, panelId } = community;
  const next = [{ id, name, slug, panelId }, ...current.filter((c) => c.id !== id)].slice(0, MAX_RECENT);
  queryClient.setQueryData(queryKeys.recentCommunities, next);
  await deviceStorage.set(StorageKeys.recentCommunities, JSON.stringify(next));
}
