import type { Author } from '@utalk/shared';

export type SearchHitKind = 'post' | 'comment';

// Un resultado de búsqueda: una publicación o un comentario que coincide,
// con lo justo para listarlo. `postId` y `postTitle` son los de la
// publicación (la misma, si el resultado es una publicación).
export class SearchHitEntity {
  constructor(
    readonly kind: SearchHitKind,
    readonly id: string,
    readonly postId: string,
    readonly postTitle: string,
    readonly communityId: string,
    readonly body: string,
    readonly score: number,
    // Solo de las publicaciones; null en los comentarios.
    readonly commentCount: number | null,
    readonly author: Author,
    readonly createdAt: Date,
  ) {}

  isPost(): boolean {
    return this.kind === 'post';
  }
}
