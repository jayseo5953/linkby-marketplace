import { z } from 'zod';

// Shape first: `Number` would read `0x10` as 16 and `1e3` as 1000.
export const positiveIntFromText = z
  .string()
  .regex(/^\d+$/, 'Must be a whole number')
  .transform(Number)
  .pipe(z.number().int().positive());

export const idParamsSchema = z.object({ id: positiveIntFromText });
