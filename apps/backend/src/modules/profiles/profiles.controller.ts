import { Controller, Get, Param } from '@nestjs/common';
import { ProfilesService } from './profiles.service.js';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

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
