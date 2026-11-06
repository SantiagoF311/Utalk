import { ReactNode } from 'react';

import { SignInPrompt } from '@/components/signInPrompt';
import { StateMessage } from '@/components/stateMessage';
import { useSession } from '@/hooks/useSession';

// Muestra `children` solo con sesión: toda la API la requiere. Mientras se lee
// la sesión guardada en el dispositivo, un indicador de carga.
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session === undefined) return <StateMessage kind="loading" />;
  if (session === null) return <SignInPrompt />;
  return children;
}
