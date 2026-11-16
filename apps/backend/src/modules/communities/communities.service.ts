import { Inject, Injectable } from '@nestjs/common';
import { CommunityView, CreateCommunityInput, UpdateCommunityInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { PanelsService } from '../panels/panels.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { toCommunityView } from './community.view.js';
import { CommunityEntity } from './domain/community.entity.js';
import { COMMUNITY_REPOSITORY } from './domain/community.repository.js';
import type { CommunityRepository } from './domain/community.repository.js';
import { COMMUNITY_MEMBER_REPOSITORY } from './domain/communityMember.repository.js';
import type { CommunityMemberRepository } from './domain/communityMember.repository.js';
import { COMMUNITY_MODERATOR_REPOSITORY } from './domain/communityModerator.repository.js';
import type { CommunityModeratorRepository } from './domain/communityModerator.repository.js';

@Injectable()
export class CommunitiesService {
  constructor(
    @Inject(COMMUNITY_REPOSITORY) private readonly communityRepository: CommunityRepository,
    @Inject(COMMUNITY_MODERATOR_REPOSITORY)
    private readonly communityModeratorRepository: CommunityModeratorRepository,
    @Inject(COMMUNITY_MEMBER_REPOSITORY)
    private readonly communityMemberRepository: CommunityMemberRepository,
    private readonly panelsService: PanelsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreateCommunityInput, userId: string): Promise<CommunityView> {
    const profile = await this.profilesService.findById(userId);
    const panel = await this.panelsService.findById(input.panelId);
    if (!panel.acceptsPostsFrom(profile.universityId)) {
      throw new AppException(
        'CANNOT_PUBLISH_IN_PANEL',
        `You cannot create communities in panel ${panel.id}`,
      );
    }

    const existing = await this.communityRepository.findByPanelAndSlug(input.panelId, input.slug);
    if (existing) {
      throw new AppException(
        'COMMUNITY_SLUG_TAKEN',
        `Community slug "${input.slug}" is already taken in this panel`,
      );
    }

    // Los triggers dejan al creador como primer moderador y como miembro.
    const created = await this.communityRepository.create({
      panelId: input.panelId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      topic: input.topic,
      createdBy: userId,
    });
    // Se relee: la fila que devuelve el insert es de antes de que el trigger
    // sume al creador en member_count.
    const community = (await this.communityRepository.findById(created.id)) ?? created;
    return toCommunityView(community, true);
  }

  async findViewsByPanelId(panelId: string, viewerId: string): Promise<CommunityView[]> {
    const communities = await this.communityRepository.findByPanelId(panelId);
    const joined = await this.communityMemberRepository.findJoinedByUser(
      communities.map((community) => community.id),
      viewerId,
    );
    return communities.map((community) => toCommunityView(community, joined.has(community.id)));
  }

  async findViewById(id: string, viewerId: string): Promise<CommunityView> {
    const [community, joined] = await Promise.all([
      this.findById(id),
      this.communityMemberRepository.findJoinedByUser([id], viewerId),
    ]);
    return toCommunityView(community, joined.has(id));
  }

  // Para otros módulos (posts) que solo necesitan la comunidad cruda.
  async findById(id: string): Promise<CommunityEntity> {
    const community = await this.communityRepository.findById(id);
    if (!community) {
      throw new AppException('COMMUNITY_NOT_FOUND', `Community ${id} not found`);
    }
    return community;
  }

  // Unirse es seguir: se puede en cualquier panel (leer es libre), aunque
  // publicar no. Idempotente.
  async join(id: string, userId: string): Promise<CommunityView> {
    await this.findById(id);
    await this.communityMemberRepository.add(id, userId);
    return this.findViewById(id, userId);
  }

  // Idempotente. Salirse no quita la moderación: son cosas distintas.
  async leave(id: string, userId: string): Promise<CommunityView> {
    await this.findById(id);
    await this.communityMemberRepository.remove(id, userId);
    return this.findViewById(id, userId);
  }

  async update(id: string, input: UpdateCommunityInput, userId: string): Promise<CommunityView> {
    await this.findModerable(id, userId);
    await this.communityRepository.update(id, {
      name: input.name,
      description: input.description,
      topic: input.topic,
    });
    return this.findViewById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findModerable(id, userId);
    await this.communityRepository.delete(id);
  }

  // Las comunidades donde es moderador (sin contar que un admin modera todas).
  async findModeratedBy(userId: string): Promise<CommunityEntity[]> {
    return this.communityRepository.findModeratedBy(userId);
  }

  // Admins moderan todo; el resto, solo las comunidades donde tiene fila en
  // community_moderators.
  async canModerate(communityId: string, userId: string): Promise<boolean> {
    const profile = await this.profilesService.findById(userId);
    if (profile.isAdmin()) {
      return true;
    }
    return this.communityModeratorRepository.isModerator(communityId, userId);
  }

  private async findModerable(id: string, userId: string): Promise<CommunityEntity> {
    const community = await this.findById(id);
    if (!(await this.canModerate(community.id, userId))) {
      throw new AppException('NOT_COMMUNITY_MODERATOR', `You cannot modify community ${id}`);
    }
    return community;
  }
}
