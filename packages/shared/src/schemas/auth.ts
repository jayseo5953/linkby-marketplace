import { z } from 'zod';

/**
 * The login contract, shared so the browser validates the same shape the API enforces and a
 * change to one cannot silently break the other. `sessionUserSchema` is deliberately the thin
 * slice a signed-in session needs — anything more would put user records in a token payload.
 */

export const loginRequestSchema = z.object({
  email: z.email(),
  // Only a presence check: the seeded demo accounts predate any password policy, and a
  // strength rule here would reject credentials that are legitimately stored.
  password: z.string().min(1),
});

export const sessionUserSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  displayName: z.string(),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  user: sessionUserSchema,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
