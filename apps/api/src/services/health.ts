import type { DependencyState, HealthResponse } from '@linkby/shared';
import * as healthRepo from '../repositories/health.repo';
import { headBucket } from '../storage/client';
import { logger } from '../lib/logger';

async function state(name: string, _check: () => Promise<unknown>): Promise<DependencyState> {
  try {
    await _check();
    return 'up';
  } catch (error) {
    logger.warn({ err: error, dependency: name }, 'health check failed');
    return 'down';
  }
}

export async function check(): Promise<HealthResponse> {
  const [database, storage] = await Promise.all([
    state('database', healthRepo.ping),
    state('storage', headBucket),
  ]);

  return {
    status: database === 'up' && storage === 'up' ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    database,
    storage,
  };
}
