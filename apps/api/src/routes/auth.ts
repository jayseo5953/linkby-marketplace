import { loginRequestSchema } from '@linkby/shared';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as authService from '../services/auth';

export const authRouter = Router();

// The blanket rejection: per-field details would name which half of the credential was malformed.
authRouter.post(
  '/api/auth/login',
  validate(loginRequestSchema, authService.credentialsRejected),
  async (req, res) => {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  },
);

authRouter.get('/api/me', authenticate, async (req, res) => {
  res.status(200).json(req.user);
});
