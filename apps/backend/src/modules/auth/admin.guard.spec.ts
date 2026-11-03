import { describe, expect, it, jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IDS, makeProfile } from '../../testing/fixtures.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import { AdminGuard } from './admin.guard.js';

function setup(adminOnly: boolean, role: 'user' | 'admin') {
  const profiles = {
    findById: jest.fn<ProfilesService['findById']>().mockResolvedValue(makeProfile({ role })),
  };
  const reflector = { getAllAndOverride: () => adminOnly } as unknown as Reflector;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ userId: IDS.ana }) }),
  } as unknown as ExecutionContext;
  return {
    guard: new AdminGuard(profiles as unknown as ProfilesService, reflector),
    profiles,
    context,
  };
}

describe('AdminGuard', () => {
  it('en endpoints normales deja pasar sin consultar el perfil', async () => {
    const { guard, profiles, context } = setup(false, 'user');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(profiles.findById).not.toHaveBeenCalled();
  });

  it('en @AdminOnly() rechaza a un usuario normal con ADMIN_ONLY', async () => {
    const { guard, context } = setup(true, 'user');

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'ADMIN_ONLY' });
  });

  it('en @AdminOnly() deja pasar a un admin', async () => {
    const { guard, context } = setup(true, 'admin');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
