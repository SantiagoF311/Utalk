import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/appException.js';
import { IDS, makeAuthor, makeCommunity, makePanel } from '../../testing/fixtures.js';
import type { CommunitiesService } from '../communities/communities.service.js';
import type { PanelsService } from '../panels/panels.service.js';
import type { SearchRepository } from './domain/search.repository.js';
import { SearchHitEntity } from './domain/searchHit.entity.js';
import { SearchService } from './search.service.js';

const COMMENT_ID = '00000000-0000-4000-8000-0000000000f1';
const CREATED_AT = new Date('2026-11-08T12:00:00.000Z');

const postHit = (id: string = IDS.post) =>
  new SearchHitEntity(
    'post',
    id,
    id,
    'Sala de estudio',
    IDS.community,
    'Abrieron la sala',
    5,
    3,
    makeAuthor(),
    CREATED_AT,
  );

const commentHit = () =>
  new SearchHitEntity(
    'comment',
    COMMENT_ID,
    IDS.post,
    'Sala de estudio',
    IDS.community,
    'Confirmo, estuve ayer',
    2,
    null,
    makeAuthor(),
    CREATED_AT,
  );

// Ids distintos para armar páginas largas.
const postId = (n: number) => `00000000-0000-4000-8000-0000000003${String(n).padStart(2, '0')}`;

describe('SearchService', () => {
  let repository: jest.Mocked<SearchRepository>;
  let panels: { findById: jest.Mock<PanelsService['findById']> };
  let communities: { findById: jest.Mock<CommunitiesService['findById']> };
  let service: SearchService;

  beforeEach(() => {
    repository = { search: jest.fn<SearchRepository['search']>().mockResolvedValue([]) };
    panels = { findById: jest.fn<PanelsService['findById']>().mockResolvedValue(makePanel()) };
    communities = {
      findById: jest.fn<CommunitiesService['findById']>().mockResolvedValue(makeCommunity()),
    };
    service = new SearchService(
      repository,
      panels as unknown as PanelsService,
      communities as unknown as CommunitiesService,
    );
  });

  it('dentro de una comunidad, busca en su panel filtrando por ella', async () => {
    await service.search({ q: 'sala', communityId: IDS.community, sort: 'relevance', limit: 2 });

    expect(repository.search).toHaveBeenCalledWith(
      expect.objectContaining({ panelId: IDS.ustPanel, communityId: IDS.community }),
    );
    expect(panels.findById).not.toHaveBeenCalled();
  });

  it('404 explícito si la comunidad no existe', async () => {
    communities.findById.mockRejectedValue(new AppException('COMMUNITY_NOT_FOUND', 'not found'));

    await expect(
      service.search({ q: 'sala', communityId: IDS.community, sort: 'relevance', limit: 2 }),
    ).rejects.toMatchObject({ code: 'COMMUNITY_NOT_FOUND' });
    expect(repository.search).not.toHaveBeenCalled();
  });

  const query = { q: 'sala', panelId: IDS.ustPanel, sort: 'relevance' as const, limit: 2 };

  it('devuelve publicaciones y comentarios, cada uno con su forma', async () => {
    repository.search.mockResolvedValue([postHit(), commentHit()]);

    const page = await service.search(query);

    expect(page.items).toEqual([
      {
        kind: 'post',
        id: IDS.post,
        communityId: IDS.community,
        title: 'Sala de estudio',
        body: 'Abrieron la sala',
        score: 5,
        commentCount: 3,
        author: makeAuthor(),
        createdAt: '2026-11-08T12:00:00.000Z',
      },
      {
        kind: 'comment',
        id: COMMENT_ID,
        postId: IDS.post,
        postTitle: 'Sala de estudio',
        body: 'Confirmo, estuve ayer',
        score: 2,
        author: makeAuthor(),
        createdAt: '2026-11-08T12:00:00.000Z',
      },
    ]);
  });

  it('pide uno de más para saber si hay otra página, y el cursor es el offset', async () => {
    repository.search.mockResolvedValue([
      postHit(postId(1)),
      postHit(postId(2)),
      postHit(postId(3)),
    ]);

    const page = await service.search(query);

    expect(repository.search).toHaveBeenCalledWith({
      query: 'sala',
      panelId: IDS.ustPanel,
      communityId: null,
      sort: 'relevance',
      limit: 3,
      offset: 0,
    });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('2');
  });

  it('sigue desde el cursor y no da otro si es la última página', async () => {
    repository.search.mockResolvedValue([postHit(postId(3))]);

    const page = await service.search({ ...query, cursor: '2' });

    expect(repository.search).toHaveBeenCalledWith(expect.objectContaining({ offset: 2 }));
    expect(page.nextCursor).toBeNull();
  });

  it('404 explícito si el panel no existe, en vez de "no hay resultados"', async () => {
    panels.findById.mockRejectedValue(new AppException('PANEL_NOT_FOUND', 'not found'));

    await expect(service.search(query)).rejects.toMatchObject({ code: 'PANEL_NOT_FOUND' });
    expect(repository.search).not.toHaveBeenCalled();
  });
});
