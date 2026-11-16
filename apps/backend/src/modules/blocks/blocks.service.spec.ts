import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/appException.js';
import { IDS, makeProfile } from '../../testing/fixtures.js';
import type { ProfilesService } from '../profiles/profiles.service.js';
import { BlocksService } from './blocks.service.js';
import { BlockEntity } from './domain/block.entity.js';
import type { BlockRepository } from './domain/block.repository.js';

describe('BlocksService', () => {
  let repository: jest.Mocked<BlockRepository>;
  let profiles: { findById: jest.Mock<ProfilesService['findById']> };
  let service: BlocksService;

  beforeEach(() => {
    repository = {
      add: jest.fn<BlockRepository['add']>().mockResolvedValue(undefined),
      remove: jest.fn<BlockRepository['remove']>().mockResolvedValue(undefined),
      findBetween: jest.fn<BlockRepository['findBetween']>().mockResolvedValue(null),
      findByBlocker: jest.fn<BlockRepository['findByBlocker']>().mockResolvedValue([]),
    };
    profiles = {
      findById: jest
        .fn<ProfilesService['findById']>()
        .mockResolvedValue(makeProfile({ id: IDS.beto })),
    };
    service = new BlocksService(repository, profiles as unknown as ProfilesService);
  });

  it('bloquea a otra persona', async () => {
    await service.block(IDS.ana, IDS.beto);
    expect(repository.add).toHaveBeenCalledWith(IDS.ana, IDS.beto);
  });

  it('CANNOT_BLOCK_SELF', async () => {
    await expect(service.block(IDS.ana, IDS.ana)).rejects.toMatchObject({
      code: 'CANNOT_BLOCK_SELF',
    });
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('propaga PROFILE_NOT_FOUND si esa persona no existe', async () => {
    profiles.findById.mockRejectedValue(new AppException('PROFILE_NOT_FOUND', 'not found'));

    await expect(service.block(IDS.ana, IDS.beto)).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });

  it('un bloqueo corta en los dos sentidos', async () => {
    repository.findBetween.mockResolvedValue(new BlockEntity(IDS.beto, IDS.ana, new Date()));

    await expect(service.isBlockedBetween(IDS.ana, IDS.beto)).resolves.toBe(true);
  });

  it('sin bloqueo, no está bloqueado', async () => {
    await expect(service.isBlockedBetween(IDS.ana, IDS.beto)).resolves.toBe(false);
  });
});
