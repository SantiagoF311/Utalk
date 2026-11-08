import { Inject, Injectable } from '@nestjs/common';
import { USERNAME_CHANGE_COOLDOWN_DAYS } from '@utalk/shared';
import type { CreateProfileInput, PublicProfile, UpdateMyProfileInput } from '@utalk/shared';
import { AppException } from '../../common/appException.js';
import { UniversitiesService } from '../universities/universities.service.js';
import { ProfileEntity } from './domain/profile.entity.js';
import { PROFILE_REPOSITORY } from './domain/profile.repository.js';
import type { ProfileRepository } from './domain/profile.repository.js';
import { USERNAME_RESERVATION_REPOSITORY } from './domain/usernameReservation.repository.js';
import type { UsernameReservationRepository } from './domain/usernameReservation.repository.js';
import { toPublicProfileView } from './profile.view.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profileRepository: ProfileRepository,
    @Inject(USERNAME_RESERVATION_REPOSITORY)
    private readonly reservationRepository: UsernameReservationRepository,
    private readonly universitiesService: UniversitiesService,
  ) {}

  async create(
    userId: string,
    input: CreateProfileInput,
    now = new Date(),
  ): Promise<ProfileEntity> {
    if (!(await this.isUsernameAvailable(input.username, now))) {
      throw new AppException('USERNAME_TAKEN', `Username "${input.username}" is already taken`);
    }

    return this.profileRepository.create({
      id: userId,
      username: input.username,
      universityId: input.universityId,
    });
  }

  async findById(id: string): Promise<ProfileEntity> {
    const profile = await this.profileRepository.findById(id);
    if (!profile) {
      throw new AppException('PROFILE_NOT_FOUND', `Profile ${id} not found`);
    }
    return profile;
  }

  // Perfil de un usuario, con su universidad resuelta (siempre se muestra) y
  // sus contadores, salvo que sea privado y no sea el de quien mira.
  async findPublicById(id: string, viewerId: string): Promise<PublicProfile> {
    const profile = await this.findById(id);
    const [university, stats] = await Promise.all([
      this.universitiesService.findById(profile.universityId),
      profile.historyVisibleTo(viewerId) ? this.profileRepository.findStats(id) : null,
    ]);
    return toPublicProfileView(profile, university, stats);
  }

  // Para posts y comentarios: antes de listar lo que escribió alguien.
  // PROFILE_NOT_FOUND si no existe, PROFILE_PRIVATE si es privado y no es el
  // de quien mira.
  async assertHistoryVisible(authorId: string, viewerId: string): Promise<void> {
    const profile = await this.findById(authorId);
    if (!profile.historyVisibleTo(viewerId)) {
      throw new AppException('PROFILE_PRIVATE', `Profile ${authorId} is private`);
    }
  }

  async findByUsername(username: string): Promise<ProfileEntity | null> {
    return this.profileRepository.findByUsername(username);
  }

  // Libre si nadie lo usa y no está reservado. Una reserva no tiene excepción
  // para quien dejó el apodo: dura lo mismo que la espera para volver a
  // cambiarlo, así que nunca podría aprovecharla.
  async isUsernameAvailable(username: string, now = new Date()): Promise<boolean> {
    const [owner, reservation] = await Promise.all([
      this.profileRepository.findByUsername(username),
      this.reservationRepository.findActive(username, now),
    ]);
    return owner === null && reservation === null;
  }

  // Cambiar el apodo y/o la privacidad del perfil propio.
  async updateMe(
    userId: string,
    input: UpdateMyProfileInput,
    now = new Date(),
  ): Promise<ProfileEntity> {
    const profile = await this.findById(userId);
    const newUsername =
      input.username !== undefined && input.username !== profile.username
        ? input.username
        : undefined;

    if (newUsername !== undefined) {
      if (!profile.canChangeUsername(now)) {
        throw new AppException(
          'USERNAME_CHANGE_TOO_SOON',
          `Username can be changed again after ${profile.nextUsernameChangeAt()?.toISOString()}`,
        );
      }
      if (!(await this.isUsernameAvailable(newUsername, now))) {
        throw new AppException('USERNAME_TAKEN', `Username "${newUsername}" is already taken`);
      }
    }

    const updated = await this.profileRepository.update(userId, {
      username: newUsername,
      usernameChangedAt: newUsername !== undefined ? now : undefined,
      isPrivate: input.isPrivate,
    });

    if (newUsername !== undefined) {
      // El apodo viejo queda reservado un tiempo, para que nadie más lo tome y
      // se haga pasar por quien lo dejó.
      await this.reservationRepository.reserve({
        username: profile.username,
        userId,
        until: new Date(now.getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * DAY_MS),
      });
    }
    return updated;
  }
}
