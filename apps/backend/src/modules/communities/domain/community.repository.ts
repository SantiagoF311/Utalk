import { CommunityEntity } from './community.entity.js';

export interface NewCommunity {
  panelId: string;
  slug: string;
  name: string;
  createdBy: string;
}

export interface CommunityChanges {
  name: string;
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
