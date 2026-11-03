import type { Panel } from '@utalk/shared';
import type { PanelEntity } from './domain/panel.entity.js';

export function toPanelView(panel: PanelEntity): Panel {
  return {
    id: panel.id,
    universityId: panel.universityId,
    slug: panel.slug,
    name: panel.name,
    createdAt: panel.createdAt.toISOString(),
  };
}
