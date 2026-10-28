import { PanelEntity } from './panel.entity.js';

export interface NewPanel {
  universityId: string | null;
  slug: string;
  name: string;
}

export interface PanelChanges {
  name: string;
}

export interface PanelRepository {
  create(panel: NewPanel): Promise<PanelEntity>;
  findAll(): Promise<PanelEntity[]>;
  findById(id: string): Promise<PanelEntity | null>;
  findBySlug(slug: string): Promise<PanelEntity | null>;
  findByUniversityId(universityId: string): Promise<PanelEntity | null>;
  update(id: string, changes: PanelChanges): Promise<PanelEntity>;
  delete(id: string): Promise<void>;
}

export const PANEL_REPOSITORY = Symbol('PANEL_REPOSITORY');
