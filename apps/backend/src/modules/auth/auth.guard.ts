import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

type AuthenticatedRequest = Request & { userId?: string };

// Valida el access token de Supabase que manda el cliente en
// `Authorization: Bearer <token>` y deja el id del usuario en el request.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
