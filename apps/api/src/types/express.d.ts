import type { SessionUser } from '@linkby/shared';

// Non-optional: the middleware filling each of these throws before any handler runs.
declare global {
  namespace Express {
    interface Request {
      user: SessionUser;
      id: number;
    }
  }
}
