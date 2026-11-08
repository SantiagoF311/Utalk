import type { CommunityTopic } from '@utalk/shared';
import { CommunityEntity } from './community.entity.js';

export interface NewCommunity {
  panelId: string;
  slug: string;
  name: string;
  description: string;
  topic: CommunityTopic;
  createdBy: string;
}

// Solo se cambia lo que viene definido.
export interface CommunityChanges {
  name?: string;
  description?: string;
  topic?: CommunityTopic;
}

export interface CommunityRepository {
  create(community: NewCommunity): Promise<CommunityEntity>;
  findById(id: string): Promise<CommunityEntity | null>;
  findByPanelId(panelId: string): Promise<CommunityEntity[]>;
  findByPanelAndSlug(panelId: string, slug: string): Promise<CommunityEntity | null>;
  update(id: string, changes: CommunityChanges): Promise<CommunityEntity>;
  delete(id: string): Promise<void>;
}

export const COMMUNITY_REPOSITORY = Symbol('COMMUNITY_REPOSITORY');
