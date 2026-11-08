import { useQuery } from '@tanstack/react-query';

import { deviceStorage, StorageKeys } from '@/lib/deviceStorage';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

const MAX_RECENT = 8;

async function readRecent(): Promise<string[]> {
  const raw = await deviceStorage.get(StorageKeys.recentSearches);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function writeRecent(next: string[]) {
  queryClient.setQueryData(queryKeys.recentSearches, next);
  await deviceStorage.set(StorageKeys.recentSearches, JSON.stringify(next));
}

async function current(): Promise<string[]> {
  return queryClient.getQueryData<string[]>(queryKeys.recentSearches) ?? (await readRecent());
}

// Búsquedas recientes (diseño 6a). Se guardan solo en el dispositivo y se
// borran al cerrar sesión, como las comunidades visitadas.
export function useRecentSearches() {
  return useQuery({ queryKey: queryKeys.recentSearches, queryFn: readRecent, staleTime: Infinity });
}

export async function addRecentSearch(query: string) {
  const list = await current();
  // Sin repetir (sin importar mayúsculas): la última búsqueda va primero.
  const rest = list.filter((item) => item.toLowerCase() !== query.toLowerCase());
  await writeRecent([query, ...rest].slice(0, MAX_RECENT));
}

export async function removeRecentSearch(query: string) {
  await writeRecent((await current()).filter((item) => item !== query));
}

export async function clearRecentSearches() {
  await writeRecent([]);
}
