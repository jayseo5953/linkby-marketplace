import { Router } from 'express';
import * as healthService from '../services/health';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const result = await healthService.check();
  res.status(result.status === 'ok' ? 200 : 503).json(result);
});
