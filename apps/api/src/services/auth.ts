import type { LoginRequest, LoginResponse, SessionUser } from '@linkby/shared';
import bcrypt from 'bcryptjs';
import { signSession } from '../lib/jwt';
import { UnauthorizedError } from '../lib/errors';
import * as userRepo from '../repositories/user.repo';

// Hashed once at load so it carries the same cost factor as a stored password. See `login`.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no account matched this login', 10);

export async function login({ email, password }: LoginRequest): Promise<LoginResponse> {
  const user = await userRepo.findByEmail(email);
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Named fields, not a spread — a spread is how `passwordHash` reaches a response body.
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };

  return { token: await signSession(sessionUser), user: sessionUser };
}
