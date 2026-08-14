import { z } from 'zod';

export const dependencyStateSchema = z.enum(['up', 'down']);

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptimeSeconds: z.number(),
  database: dependencyStateSchema,
  storage: dependencyStateSchema,
});

export type DependencyState = z.infer<typeof dependencyStateSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
