import { pool } from '../db/client';

export async function ping(): Promise<void> {
  await pool.query('select 1');
}
