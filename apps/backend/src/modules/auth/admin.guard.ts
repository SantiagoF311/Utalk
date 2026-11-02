import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { AuthenticatedRequest } from './auth.guard.js';

const IS_ADMIN_ONLY_KEY = 'isAdminOnly';

// Marca un endpoint como exclusivo de admins (profiles.role = 'admin').
// La moderación por foro no pasa por acá: se valida en cada service contra
// forum_moderators, porque depende de qué foro se toca.
export const AdminOnly = () => SetMetadata(IS_ADMIN_ONLY_KEY, true);

// Guard global (registrado como APP_GUARD en AppModule, después de
// AuthGuard): solo consulta el perfil en endpoints marcados con @AdminOnly(),
// el resto de la API no paga la consulta extra.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAdminOnly = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isAdminOnly) {
      return true;
    }

    const { userId } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const profile = userId ? await this.profilesService.findById(userId) : null;
    if (!profile?.isAdmin()) {
      throw new ForbiddenException();
    }

    return true;
  }
}
