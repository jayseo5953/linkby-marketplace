import type { SessionUser } from '@linkby/shared';

// Non-optional: `authenticate` loads the row and throws before any handler runs.
declare global {
  namespace Express {
    interface Request {
      user: SessionUser;
    }
  }
}
