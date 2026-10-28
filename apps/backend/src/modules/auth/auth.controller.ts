import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { completeRegistrationSchema, loginSchema } from '@utalk/shared';
import { AuthGuard, CurrentUserId } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('complete-registration')
  @UseGuards(AuthGuard)
  async completeRegistration(@CurrentUserId() userId: string, @Body() body: unknown) {
    const input = completeRegistrationSchema.parse(body);
    return this.authService.completeRegistration(userId, input.username);
  }

  // 404 si el usuario tiene cuenta pero todavía no eligió usuario (cerró la
  // app entre verificar el correo y crear el perfil).
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUserId() userId: string) {
    return this.authService.getProfile(userId);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const input = loginSchema.parse(body);
    return this.authService.login(input.identifier, input.password);
  }
}
