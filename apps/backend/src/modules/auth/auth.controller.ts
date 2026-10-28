import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { completeRegistrationSchema, loginSchema } from '@utalk/shared';
import { CurrentUserId, Public } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('complete-registration')
  async completeRegistration(@CurrentUserId() userId: string, @Body() body: unknown) {
    const input = completeRegistrationSchema.parse(body);
    return this.authService.completeRegistration(userId, input.username);
  }

  // 404 si el usuario tiene cuenta pero todavía no eligió usuario (cerró la
  // app entre verificar el correo y crear el perfil).
  @Get('me')
  async me(@CurrentUserId() userId: string) {
    return this.authService.getProfile(userId);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const input = loginSchema.parse(body);
    return this.authService.login(input.identifier, input.password);
  }
}
