// Identity only. A `role` claim would be a login-time snapshot still trusted a day later, so
// "may this user do X" stays a query inside a service.
import { SignJWT, errors, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import type { SessionUser } from '@linkby/shared';
import { config } from '../config';
import { UnauthorizedError } from './errors';

export type SessionClaims = { userId: number; email: string; displayName: string };

const SESSION_LIFETIME = '24h';

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, displayName: user.displayName })
    .setProtectedHeader({ alg: 'HS256' })
    // RFC 7519 requires `sub` to be a string.
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(SESSION_LIFETIME)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims> {
  let payload: JWTPayload;

  try {
    const verified = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    payload = verified.payload;
  } catch (error) {

    throw error instanceof errors.JWTExpired
      ? new UnauthorizedError('Session expired', 'TOKEN_EXPIRED')
      : new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
  }

  const userId = Number(payload.sub);
  const { email, displayName } = payload;

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    typeof email !== 'string' ||
    typeof displayName !== 'string'
  ) {
    throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
  }

  return { userId, email, displayName };
}
