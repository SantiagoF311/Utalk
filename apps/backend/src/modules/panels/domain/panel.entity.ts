export class PanelEntity {
  // El panel general se identifica por slug, no por `universityId === null`:
  // pueden existir otros paneles especiales sin universidad (ver docs/modelo-de-datos.md).
  static readonly GENERAL_SLUG = 'general';

  constructor(
    readonly id: string,
    readonly universityId: string | null,
    readonly slug: string,
    readonly name: string,
    readonly createdAt: Date,
  ) {}

  isGeneral(): boolean {
    return this.slug === PanelEntity.GENERAL_SLUG;
  }

  belongsToUniversity(universityId: string): boolean {
    return this.universityId === universityId;
  }

  // Crear comunidades y postear: solo en el panel de tu universidad o en uno sin
  // universidad (el general, o uno especial futuro). Leer, comentar y votar
  // es libre en cualquier panel.
  acceptsPostsFrom(universityId: string): boolean {
    return this.universityId === null || this.belongsToUniversity(universityId);
  }
}
