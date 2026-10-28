import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

type AuthenticatedRequest = Request & { userId?: string };

const IS_PUBLIC_KEY = 'isPublic';

// Marca un endpoint como accesible sin sesión. Usar solo para lo mínimo que
// necesita alguien que todavía no entró (login, registro, health checks).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Guard global (registrado como APP_GUARD en AppModule): toda la API exige
// sesión salvo lo marcado con @Public(). Valida el access token de Supabase
// que manda el cliente en `Authorization: Bearer <token>` y deja el id del
// usuario en el request.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    const userId = await this.authService.getUserIdByAccessToken(token);
    if (!userId) {
      throw new UnauthorizedException();
    }

    request.userId = userId;
    return true;
  }
}

export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().userId;
});
