import { loginRequestSchema } from '@linkby/shared';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as authService from '../services/auth';

export const authRouter = Router();

authRouter.post('/api/auth/login', validate(loginRequestSchema), async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json(result);
});

authRouter.get('/api/me', authenticate, async (req, res) => {
  res.status(200).json(req.user);
});
