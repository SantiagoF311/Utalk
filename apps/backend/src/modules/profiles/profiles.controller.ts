import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { updateMyProfileSchema } from '@utalk/shared';
import type { Profile, PublicProfile } from '@utalk/shared';
import { CurrentUserId, Public } from '../auth/auth.guard.js';
import { toProfileView } from './profile.view.js';
import { ProfilesService } from './profiles.service.js';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // Público: el registro lo consulta antes de que exista la cuenta, y también
  // la pantalla de cambiar el apodo. Un apodo reservado (alguien lo dejó hace
  // menos de 30 días) cuenta como tomado.
  @Public()
  @Get('check-username/:username')
  async checkUsername(@Param('username') username: string) {
    const available = await this.profilesService.isUsernameAvailable(username);
    return { available };
  }

  // Cambiar el apodo (una vez cada 30 días) y/o la privacidad del perfil
  // propio. Devuelve el perfil propio completo, como GET /auth/me.
  @Patch('me')
  async updateMe(@Body() body: unknown, @CurrentUserId() userId: string): Promise<Profile> {
    const input = updateMyProfileSchema.parse(body);
    return toProfileView(await this.profilesService.updateMe(userId, input));
  }

  // Perfil de un usuario (el propio o el de otro): con su universidad, sin el
  // rol, y con sus contadores salvo que sea privado y no sea el propio.
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ): Promise<PublicProfile> {
    return this.profilesService.findPublicById(id, userId);
  }
}
