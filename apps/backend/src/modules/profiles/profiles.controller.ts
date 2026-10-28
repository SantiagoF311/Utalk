import { Controller, Get, Param } from '@nestjs/common';
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

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.profilesService.findById(id);
  }
}
