import { z } from 'zod';
import { profileSchema } from './profile.ts';

export const emailSchema = z.email();

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

export const completeRegistrationSchema = profileSchema.pick({
  username: true,
});

export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;
