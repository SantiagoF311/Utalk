import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { createProfileSchema } from '@utalk/shared';
import { ProfilesService } from './profiles.service.js';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post(':userId')
  async create(@Param('userId') userId: string, @Body() body: unknown) {
    const input = createProfileSchema.parse(body);
    return this.profilesService.create(userId, input);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.profilesService.findById(id);
  }
}
