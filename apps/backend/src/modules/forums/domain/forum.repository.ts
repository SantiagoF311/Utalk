import { ForumEntity } from './forum.entity.js';

export interface NewForum {
  panelId: string;
  slug: string;
  name: string;
  createdBy: string;
}

export interface ForumChanges {
  name: string;
}

export interface ForumRepository {
  create(forum: NewForum): Promise<ForumEntity>;
  findById(id: string): Promise<ForumEntity | null>;
  findByPanelId(panelId: string): Promise<ForumEntity[]>;
  findByPanelAndSlug(panelId: string, slug: string): Promise<ForumEntity | null>;
  update(id: string, changes: ForumChanges): Promise<ForumEntity>;
  delete(id: string): Promise<void>;
}

export const FORUM_REPOSITORY = Symbol('FORUM_REPOSITORY');
