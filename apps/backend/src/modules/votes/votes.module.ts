import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { COMMENT_VOTE_REPOSITORY } from './domain/commentVote.repository.js';
import { POST_VOTE_REPOSITORY } from './domain/postVote.repository.js';
import { SupabaseCommentVoteRepository } from './infrastructure/supabase-commentVote.repository.js';
import { SupabasePostVoteRepository } from './infrastructure/supabase-postVote.repository.js';
import { VotesController } from './votes.controller.js';
import { VotesService } from './votes.service.js';

@Module({
  imports: [PostsModule, CommentsModule, ProfilesModule],
  controllers: [VotesController],
  providers: [
    VotesService,
    { provide: POST_VOTE_REPOSITORY, useClass: SupabasePostVoteRepository },
    { provide: COMMENT_VOTE_REPOSITORY, useClass: SupabaseCommentVoteRepository },
  ],
  exports: [VotesService],
})
export class VotesModule {}
