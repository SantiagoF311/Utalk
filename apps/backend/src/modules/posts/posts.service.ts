import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  CreatePostInput,
  PostFeedQuery,
  PostPage,
  PostView,
  UpdatePostInput,
  VoteValue,
} from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { CommunitiesService } from '../communities/communities.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PanelsService } from '../panels/panels.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { PostEntity } from './domain/post.entity.js';
import { POST_REPOSITORY } from './domain/post.repository.js';
import type { PostRepository, PostWithAuthor } from './domain/post.repository.js';
import { detectImageType, imageExtension } from './domain/postImage.js';
import type { PostImageUpload } from './domain/postImage.js';
import { POST_IMAGE_STORAGE } from './domain/postImage.storage.js';
import type { PostImageStorage } from './domain/postImage.storage.js';
import { toPostView } from './post.view.js';

function assertNotRemoved(post: PostEntity): void {
  if (post.isRemoved()) {
    throw new AppException('POST_REMOVED', `Post ${post.id} was removed by moderation`);
  }
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @Inject(POST_REPOSITORY) private readonly postRepository: PostRepository,
    @Inject(POST_IMAGE_STORAGE) private readonly imageStorage: PostImageStorage,
    private readonly communitiesService: CommunitiesService,
    private readonly panelsService: PanelsService,
    private readonly profilesService: ProfilesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    input: CreatePostInput,
    authorId: string,
    image: PostImageUpload | null = null,
  ): Promise<PostView> {
    // Antes que nada: un archivo que no es imagen no gasta ni una consulta.
    const imageType = image ? detectImageType(image.content) : null;
    if (image && !imageType) {
      throw new AppException('INVALID_IMAGE', 'The image must be a JPEG, PNG or WebP file');
    }

    // Perfil y comunidad no dependen entre sí: se piden en paralelo. El panel
    // necesita el panelId de la comunidad, así que va después.
    const [author, community] = await Promise.all([
      this.profilesService.findById(authorId),
      this.communitiesService.findById(input.communityId),
    ]);
    const panel = await this.panelsService.findById(community.panelId);
    if (!panel.acceptsPostsFrom(author.universityId)) {
      throw new AppException(
        'CANNOT_PUBLISH_IN_PANEL',
        `You cannot post in community ${community.id}`,
      );
    }

    // La imagen se sube recién cuando se sabe que puede publicar.
    let imagePath: string | null = null;
    if (image && imageType) {
      imagePath = `${authorId}/${randomUUID()}.${imageExtension(imageType)}`;
      await this.imageStorage.upload(imagePath, image.content, imageType);
    }

    let item: PostWithAuthor;
    try {
      item = await this.postRepository.create({
        communityId: input.communityId,
        authorId,
        title: input.title,
        body: input.body,
        imagePath,
      });
    } catch (error) {
      // Sin post, la imagen subida no la referencia nadie.
      if (imagePath) await this.deleteImage(imagePath);
      throw error;
    }

    // Solo encola (barato): avisar a los miembros lo hace el worker después.
    await this.notificationsService.enqueueNewPost(item.post.id);
    // myVote es null por definición: nadie votó un post que acaba de nacer.
    // Si algún día se agrega el voto automático del autor (como Reddit),
    // esto tiene que pasar a 1. Y nadie puede haberlo reportado todavía.
    return this.toView(item, null, false);
  }

  async findFeed(query: PostFeedQuery, viewerId: string): Promise<PostPage> {
    // 404 explícito si la comunidad/panel/autor no existe, en vez de una página
    // vacía. Las publicaciones de alguien no se listan si su perfil es privado
    // (salvo para él mismo).
    if (query.communityId) {
      await this.communitiesService.findById(query.communityId);
    } else if (query.panelId) {
      await this.panelsService.findById(query.panelId);
    } else if (query.authorId) {
      await this.profilesService.assertHistoryVisible(query.authorId, viewerId);
    }

    const page = await this.postRepository.findPage(query);
    const postIds = page.items.map((item) => item.post.id);
    // Votos y reportes de quien mira no dependen entre sí: en paralelo.
    const [myVotes, reported] = await Promise.all([
      this.postRepository.findVotesByUser(postIds, viewerId),
      this.postRepository.findReportedByUser(postIds, viewerId),
    ]);

    return {
      items: page.items.map((item) =>
        this.toView(item, myVotes.get(item.post.id) ?? null, reported.has(item.post.id)),
      ),
      nextCursor: page.nextCursor,
    };
  }

  async findViewById(id: string, viewerId: string): Promise<PostView> {
    // El post, el voto y el reporte de quien mira se piden en paralelo.
    const [item, myVotes, reported] = await Promise.all([
      this.postRepository.findWithAuthorById(id),
      this.postRepository.findVotesByUser([id], viewerId),
      this.postRepository.findReportedByUser([id], viewerId),
    ]);
    if (!item) {
      throw new AppException('POST_NOT_FOUND', `Post ${id} not found`);
    }
    assertNotRemoved(item.post);
    return this.toView(item, myVotes.get(id) ?? null, reported.has(id));
  }

  // Para otros módulos (comentarios, votos, reportes) que solo necesitan
  // saber que el post existe o leer sus datos crudos. Uno eliminado por
  // moderación da POST_REMOVED: no se comenta, vota ni reporta.
  async findById(id: string): Promise<PostEntity> {
    const post = await this.findByIdIncludingRemoved(id);
    assertNotRemoved(post);
    return post;
  }

  // Para la moderación, que necesita el post aunque ya esté eliminado.
  async findByIdIncludingRemoved(id: string): Promise<PostEntity> {
    const post = await this.postRepository.findById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', `Post ${id} not found`);
    }
    return post;
  }

  // Para la moderación: al eliminar un post, su imagen deja de existir
  // también (puede ser justo lo que expone a alguien).
  async discardImage(post: PostEntity): Promise<void> {
    if (post.imagePath) await this.deleteImage(post.imagePath);
  }

  async update(id: string, input: UpdatePostInput, userId: string): Promise<PostView> {
    await this.findEditable(id, userId);
    await this.postRepository.update(id, { title: input.title, body: input.body });
    return this.findViewById(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const post = await this.findEditable(id, userId);
    await this.postRepository.delete(id);
    await this.discardImage(post);
  }

  private async findEditable(id: string, userId: string): Promise<PostEntity> {
    const post = await this.findById(id);
    if (!post.isEditableBy(userId)) {
      throw new AppException('NOT_POST_AUTHOR', `You cannot modify post ${id}`);
    }
    return post;
  }

  private toView(item: PostWithAuthor, myVote: VoteValue | null, reportedByMe: boolean): PostView {
    const imageUrl = item.post.imagePath ? this.imageStorage.publicUrl(item.post.imagePath) : null;
    return toPostView(item, myVote, reportedByMe, imageUrl);
  }

  // Borrar del bucket nunca hace fallar lo que ya se hizo en la base: si
  // falla, queda un archivo huérfano (se loguea), no un error para el usuario.
  private async deleteImage(path: string): Promise<void> {
    try {
      await this.imageStorage.delete(path);
    } catch (error) {
      this.logger.error(`Could not delete post image ${path}`, error);
    }
  }
}
