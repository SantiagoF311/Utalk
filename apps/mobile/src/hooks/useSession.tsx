import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { clearRevealedReports } from '@/hooks/useRevealedReport';
import { deviceStorage } from '@/lib/deviceStorage';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

// `undefined` mientras se lee la sesión guardada en el dispositivo; `null`
// si no hay sesión.
type SessionState = Session | null | undefined;

const SessionContext = createContext<SessionState>(undefined);

// Única suscripción a los cambios de sesión de Supabase en toda la app: el
// resto la lee con useSession(), en vez de suscribirse cada uno por su lado.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // Al cerrar sesión se vacía la caché: si entra otra cuenta en el mismo
      // dispositivo, no puede ver datos (ej. "mi voto") de la anterior.
      // Lo mismo con lo guardado en el dispositivo (panel elegido, visitados).
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        void deviceStorage.clearAccountData();
        clearRevealedReports();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
