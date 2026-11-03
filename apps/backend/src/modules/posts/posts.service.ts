import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatePostInput,
  PostFeedQuery,
  PostPage,
  PostView,
  UpdatePostInput,
} from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { ForumsService } from '../forums/forums.service.js';
import { PanelsService } from '../panels/panels.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { PostEntity } from './domain/post.entity.js';
import { POST_REPOSITORY } from './domain/post.repository.js';
import type { PostRepository } from './domain/post.repository.js';
import { toPostView } from './post.view.js';

@Injectable()
export class PostsService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly postRepository: PostRepository,
    private readonly forumsService: ForumsService,
    private readonly panelsService: PanelsService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(input: CreatePostInput, authorId: string): Promise<PostView> {
    // Perfil y foro no dependen entre sí: se piden en paralelo. El panel
    // necesita el panelId del foro, así que va después.
    const [author, forum] = await Promise.all([
      this.profilesService.findById(authorId),
      this.forumsService.findById(input.forumId),
    ]);
    const panel = await this.panelsService.findById(forum.panelId);
    if (!panel.acceptsPostsFrom(author.universityId)) {
      throw new AppException('CANNOT_PUBLISH_IN_PANEL', `You cannot post in forum ${forum.id}`);
    }

    const item = await this.postRepository.create({
      forumId: input.forumId,
      authorId,
      title: input.title,
      body: input.body,
    });
    // myVote es null por definición: nadie votó un post que acaba de nacer.
    // Si algún día se agrega el voto automático del autor (como Reddit),
    // esto tiene que pasar a 1.
    return toPostView(item, null);
  }

  async findFeed(query: PostFeedQuery, viewerId: string): Promise<PostPage> {
    // 404 explícito si el foro/panel no existe, en vez de una página vacía.
    if (query.forumId) {
      await this.forumsService.findById(query.forumId);
    } else if (query.panelId) {
      await this.panelsService.findById(query.panelId);
    }

    const page = await this.postRepository.findPage(query);
    const myVotes = await this.postRepository.findVotesByUser(
      page.items.map((item) => item.post.id),
      viewerId,
    );

    return {
      items: page.items.map((item) => toPostView(item, myVotes.get(item.post.id) ?? null)),
      nextCursor: page.nextCursor,
    };
  }

  async findViewById(id: string, viewerId: string): Promise<PostView> {
    // El post y el voto de quien mira se piden en paralelo.
    const [item, myVotes] = await Promise.all([
      this.postRepository.findWithAuthorById(id),
      this.postRepository.findVotesByUser([id], viewerId),
    ]);
    if (!item) {
      throw new AppException('POST_NOT_FOUND', `Post ${id} not found`);
    }
    return toPostView(item, myVotes.get(id) ?? null);
  }

  // Para otros módulos (comentarios, votos, reportes) que solo necesitan
  // saber que el post existe o leer sus datos crudos.
  async findById(id: string): Promise<PostEntity> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', `Post ${id} not found`);
    }
    return post;
  }

  async update(id: string, input: UpdatePostInput, userId: string): Promise<PostView> {
    await this.findEditable(id, userId);
    await this.postRepository.update(id, { title: input.title, body: input.body });
    return this.findViewById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findEditable(id, userId);
    await this.postRepository.delete(id);
  }

  private async findEditable(id: string, userId: string): Promise<PostEntity> {
    const post = await this.findById(id);
    if (!post.isEditableBy(userId)) {
      throw new AppException('NOT_POST_AUTHOR', `You cannot modify post ${id}`);
    }
    return post;
  }
}
