import { Body, Controller, Delete, HttpCode, Param, Put } from '@nestjs/common';
import { expoPushTokenSchema, registerPushTokenSchema } from '@utalk/shared';
import { CurrentUserId } from '../auth/auth.guard.js';
import { PushService } from './push.service.js';

// El mobile registra su celular al entrar y lo borra al cerrar sesión. Los
// avisos los manda el worker de la cola `push`.
@Controller('push-tokens')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Put()
  @HttpCode(204)
  async register(@Body() body: unknown, @CurrentUserId() userId: string): Promise<void> {
    await this.pushService.register(registerPushTokenSchema.parse(body), userId);
  }

  @Delete(':token')
  @HttpCode(204)
  async unregister(@Param('token') token: string, @CurrentUserId() userId: string): Promise<void> {
    await this.pushService.unregister(expoPushTokenSchema.parse(token), userId);
  }
}
