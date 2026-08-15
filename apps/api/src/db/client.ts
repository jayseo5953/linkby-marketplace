import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../lib/logger';
import * as schema from './schema';

/** Exists so /health can prove connectivity. */
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  // Defaults to 0, meaning wait forever — a connection attempt to an unreachable
  // host would never come back.
  connectionTimeoutMillis: 2_000,
});

// An idle client errors when Postgres goes away. `pg` emits this on the pool, and an
// unhandled 'error' event takes the process down — so /health could never report the
// outage it exists to report.
pool.on('error', (error) => {
  logger.warn({ err: error }, 'idle postgres client errored');
});

export const db = drizzle(pool, { schema });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Executor = Tx | typeof db;
