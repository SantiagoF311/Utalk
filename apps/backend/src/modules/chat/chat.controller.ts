import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { messagePageQuerySchema, sendMessageSchema, startConversationSchema } from '@utalk/shared';
import type {
  ConversationView,
  List,
  MessagePage,
  MessageView,
  StartConversationResult,
} from '@utalk/shared';
import { STRICT_RATE_LIMITS } from '../../common/rateLimits.js';
import { CurrentUserId } from '../auth/auth.guard.js';
import { toConversationView, toMessageView } from './chat.view.js';
import { ChatService } from './chat.service.js';

// Todo lo que escribe pasa por acá; el mobile solo lee directo de Supabase
// por Realtime (ver docs/chat-realtime.md).
@Controller('conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async findMine(@CurrentUserId() userId: string): Promise<List<ConversationView>> {
    const summaries = await this.chatService.findMine(userId);
    return { items: summaries.map((summary) => toConversationView(summary, userId)) };
  }

  // Antes que `:id`, para que "with" no se tome como un id.
  @Get('with/:userId')
  async findWith(
    @Param('userId', ParseUUIDPipe) otherUserId: string,
    @CurrentUserId() userId: string,
  ): Promise<ConversationView> {
    return toConversationView(await this.chatService.findWith(otherUserId, userId), userId);
  }

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ): Promise<ConversationView> {
    return toConversationView(await this.chatService.findSummary(id, userId), userId);
  }

  // GET /conversations/:id/messages?cursor=…, del más nuevo al más viejo.
  @Get(':id/messages')
  async findMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() rawQuery: unknown,
    @CurrentUserId() userId: string,
  ): Promise<MessagePage> {
    const query = messagePageQuerySchema.parse(rawQuery);
    const page = await this.chatService.findMessages(id, query, userId);
    return { items: page.items.map(toMessageView), nextCursor: page.nextCursor };
  }

  @Throttle(STRICT_RATE_LIMITS.startConversation)
  @Post()
  async start(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<StartConversationResult> {
    const input = startConversationSchema.parse(body);
    const { summary, message } = await this.chatService.start(input, userId);
    return { conversation: toConversationView(summary, userId), message: toMessageView(message) };
  }

  @Throttle(STRICT_RATE_LIMITS.sendMessage)
  @Post(':id/messages')
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<MessageView> {
    const input = sendMessageSchema.parse(body);
    return toMessageView(await this.chatService.send(id, input, userId));
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    await this.chatService.markRead(id, userId);
  }
}
