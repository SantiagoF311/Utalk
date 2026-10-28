import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { emailSchema } from '@utalk/shared';
import type { AuthSession } from '@utalk/shared';
import { AUTH_REPOSITORY } from './domain/auth.repository.js';
import type { AuthRepository } from './domain/auth.repository.js';
import { ProfileEntity } from '../profiles/domain/profile.entity.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { UniversitiesService } from '../universities/universities.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    private readonly universitiesService: UniversitiesService,
    private readonly profilesService: ProfilesService,
  ) {}

  async completeRegistration(userId: string, username: string): Promise<ProfileEntity> {
    const email = await this.authRepository.getEmailByUserId(userId);
    if (!email) {
      throw new UnauthorizedException();
    }

    const university = await this.universitiesService.findByEmail(email);

    return this.profilesService.create(userId, {
      username,
      universityId: university.id,
    });
  }

  async getProfile(userId: string): Promise<ProfileEntity> {
    return this.profilesService.findById(userId);
  }

  // El correo nunca sale del backend: devolverlo dejaría a cualquiera
  // averiguar el correo institucional (y con eso el nombre real) detrás de
  // un usuario anónimo.
  async login(identifier: string, password: string): Promise<AuthSession> {
    const email = await this.findEmailByIdentifier(identifier);
    const session = email ? await this.authRepository.signInWithPassword(email, password) : null;

    // Mismo error si el usuario no existe o si la contraseña está mal, para
    // no revelar qué usuarios existen.
    if (!session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return session;
  }

  async getUserIdByAccessToken(accessToken: string): Promise<string | null> {
    return this.authRepository.getUserIdByAccessToken(accessToken);
  }

  private async findEmailByIdentifier(identifier: string): Promise<string | null> {
    if (emailSchema.safeParse(identifier).success) {
      return identifier;
    }

    const profile = await this.profilesService.findByUsername(identifier);
    return profile ? this.authRepository.getEmailByUserId(profile.id) : null;
  }
}
