import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../lib/errors';
import { verifySession } from '../lib/jwt';
import * as userRepo from '../repositories/user.repo';

const BEARER = /^Bearer (\S+)$/;

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = BEARER.exec(req.get('authorization') ?? '')?.[1];

  if (!token) {
    throw new UnauthorizedError('Missing bearer token');
  }

  const claims = await verifySession(token);
  const user = await userRepo.findById(claims.userId);

  // A signed token for an account that no longer exists is a token to reject, not a caller to trust.
  if (!user) {
    throw new UnauthorizedError('Authentication required', 'INVALID_TOKEN');
  }

  req.user = user;
  next();
};
