import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { PublicProfile } from '@utalk/shared';
import { Public } from '../auth/auth.guard.js';
import { ProfilesService } from './profiles.service.js';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // Público: el registro lo consulta antes de que exista la cuenta.
  @Public()
  @Get('check-username/:username')
  async checkUsername(@Param('username') username: string) {
    const available = await this.profilesService.isUsernameAvailable(username);
    return { available };
  }

  // Perfil de otro usuario: con su universidad, sin el rol. El propio
  // (completo) es GET /auth/me.
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<PublicProfile> {
    return this.profilesService.findPublicById(id);
  }
}
