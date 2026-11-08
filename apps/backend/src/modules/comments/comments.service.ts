import { Inject, Injectable } from '@nestjs/common';
import type { CommentView, CreateCommentInput, UpdateCommentInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { PostsService } from '../posts/posts.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { CommentEntity } from './domain/comment.entity.js';
import { COMMENT_REPOSITORY } from './domain/comment.repository.js';
import type { CommentRepository } from './domain/comment.repository.js';
import { toCommentView } from './comment.view.js';

// Más votados primero; a igual score, el más antiguo primero (como el
// "mejores" de Reddit, simplificado).
function compareComments(a: CommentView, b: CommentView): number {
  return b.score - a.score || a.createdAt.localeCompare(b.createdAt);
}

@Injectable()
export class CommentsService {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly commentRepository: CommentRepository,
    private readonly postsService: PostsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreateCommentInput, authorId: string): Promise<CommentView> {
    // Perfil, post y comentario padre no dependen entre sí: en paralelo.
    const [, , parent] = await Promise.all([
      this.profilesService.findById(authorId),
      this.postsService.findById(input.postId),
      input.parentId === null ? null : this.findById(input.parentId),
    ]);

    if (parent) {
      // La FK de parent_id no garantiza que el padre sea del mismo post.
      if (!parent.belongsToPost(input.postId)) {
        throw new AppException(
          'PARENT_COMMENT_MISMATCH',
          `Comment ${input.parentId} does not belong to post ${input.postId}`,
        );
      }
      if (parent.isDeleted()) {
        throw new AppException('COMMENT_DELETED', `Comment ${input.parentId} was deleted`);
      }
    }

    const item = await this.commentRepository.create({
      postId: input.postId,
      parentId: input.parentId,
      authorId,
      body: input.body,
    });
    // myVote y el reporte no existen todavía: el comentario acaba de nacer.
    return toCommentView(item, null, false);
  }

  // Todos los comentarios del post como árbol: cada uno trae sus respuestas
  // en `replies`. Se trae la lista plana en una sola consulta y se arma en
  // memoria (un post universitario no tiene miles de comentarios).
  async findTreeByPostId(postId: string, viewerId: string): Promise<CommentView[]> {
    await this.postsService.findById(postId);

    const items = await this.commentRepository.findWithAuthorByPostId(postId);
    const commentIds = items.map((item) => item.comment.id);
    // Votos y reportes de quien mira no dependen entre sí: en paralelo.
    const [myVotes, reported] = await Promise.all([
      this.commentRepository.findVotesByUser(commentIds, viewerId),
      this.commentRepository.findReportedByUser(commentIds, viewerId),
    ]);

    const views = new Map<string, CommentView>();
    for (const item of items) {
      const id = item.comment.id;
      views.set(id, toCommentView(item, myVotes.get(id) ?? null, reported.has(id)));
    }

    const roots: CommentView[] = [];
    for (const view of views.values()) {
      const parent = view.parentId ? views.get(view.parentId) : undefined;
      if (parent) {
        parent.replies.push(view);
      } else {
        roots.push(view);
      }
    }

    for (const view of views.values()) {
      view.replies.sort(compareComments);
    }
    return roots.sort(compareComments);
  }

  async findViewById(id: string, viewerId: string): Promise<CommentView> {
    // El comentario, el voto y el reporte de quien mira se piden en paralelo.
    const [item, myVotes, reported] = await Promise.all([
      this.commentRepository.findWithAuthorById(id),
      this.commentRepository.findVotesByUser([id], viewerId),
      this.commentRepository.findReportedByUser([id], viewerId),
    ]);
    if (!item) {
      throw new AppException('COMMENT_NOT_FOUND', `Comment ${id} not found`);
    }
    return toCommentView(item, myVotes.get(id) ?? null, reported.has(id));
  }

  // Para otros módulos (votos, reportes) que solo necesitan el comentario crudo.
  async findById(id: string): Promise<CommentEntity> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new AppException('COMMENT_NOT_FOUND', `Comment ${id} not found`);
    }
    return comment;
  }

  async update(id: string, input: UpdateCommentInput, userId: string): Promise<CommentView> {
    await this.findEditable(id, userId);
    await this.commentRepository.update(id, { body: input.body });
    return this.findViewById(id, userId);
  }

  // Borrado lógico: las respuestas se conservan.
  async delete(id: string, userId: string): Promise<void> {
    await this.findEditable(id, userId);
    await this.commentRepository.softDelete(id);
  }

  private async findEditable(id: string, userId: string): Promise<CommentEntity> {
    const comment = await this.findById(id);
    // Se chequea antes que la autoría para dar el motivo real: un borrado no
    // se puede tocar ni siquiera por su autor.
    if (comment.isDeleted()) {
      throw new AppException('COMMENT_DELETED', `Comment ${id} was deleted`);
    }
    if (!comment.isEditableBy(userId)) {
      throw new AppException('NOT_COMMENT_AUTHOR', `You cannot modify comment ${id}`);
    }
    return comment;
  }
}
