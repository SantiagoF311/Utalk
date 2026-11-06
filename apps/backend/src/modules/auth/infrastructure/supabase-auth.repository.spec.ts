import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseService } from '../../../supabase/supabase.service.js';
import { SupabaseAuthRepository } from './supabase-auth.repository.js';

type GetClaimsResult = { data: { claims: Record<string, unknown> } | null; error: Error | null };

function repositoryWith(result: GetClaimsResult) {
  const getClaims = jest.fn<(jwt: string) => Promise<GetClaimsResult>>().mockResolvedValue(result);
  const supabase = { client: { auth: { getClaims } } } as unknown as SupabaseService;
  return { repository: new SupabaseAuthRepository(supabase), getClaims };
}

describe('SupabaseAuthRepository.getUserIdByAccessToken', () => {
  it('devuelve el id (sub) de un token de sesión válido', async () => {
    const { repository, getClaims } = repositoryWith({
      data: { claims: { sub: 'user-1', role: 'authenticated' } },
      error: null,
    });

    await expect(repository.getUserIdByAccessToken('token')).resolves.toBe('user-1');
    expect(getClaims).toHaveBeenCalledWith('token');
  });

  it('null si la firma o el vencimiento no son válidos', async () => {
    const { repository } = repositoryWith({ data: null, error: new Error('invalid JWT') });

    await expect(repository.getUserIdByAccessToken('token')).resolves.toBeNull();
  });

  it('null si el token no es de un usuario (otro rol)', async () => {
    const { repository } = repositoryWith({
      data: { claims: { sub: 'x', role: 'service_role' } },
      error: null,
    });

    await expect(repository.getUserIdByAccessToken('token')).resolves.toBeNull();
  });

  it('null si el token no trae sub', async () => {
    const { repository } = repositoryWith({
      data: { claims: { role: 'authenticated' } },
      error: null,
    });

    await expect(repository.getUserIdByAccessToken('token')).resolves.toBeNull();
  });
});
