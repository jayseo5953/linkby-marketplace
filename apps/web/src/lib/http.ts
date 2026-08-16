import { z } from 'zod';
import { ROUTES } from './routes';
import { clearStoredSession, readStoredSession } from './session';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const failureSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// The API owns the wording; the fallback covers no answer and an unparseable one alike.
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  // FormData sets its own multipart boundary, so only a JSON string gets a content type here.
  const sendsJson = typeof init.body === 'string' && !headers.has('Content-Type');
  if (sendsJson) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return schema.parse(body);

  const failure = failureSchema.safeParse(body);
  throw failure.success
    ? new ApiError(response.status, failure.data.error.code, failure.data.error.message)
    : new ApiError(response.status, 'UNKNOWN', 'Something went wrong');
}

export async function authedRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const session = readStoredSession();
  const headers = new Headers(init.headers);
  if (session !== null) headers.set('Authorization', `Bearer ${session.token}`);

  try {
    return await request(path, schema, { ...init, headers });
  } catch (error) {
    // A 401 here means the session is over; reloading guarantees no authenticated state survives.
    if (error instanceof ApiError && error.status === 401) {
      clearStoredSession();
      window.location.assign(ROUTES.login);
    }

    throw error;
  }
}
