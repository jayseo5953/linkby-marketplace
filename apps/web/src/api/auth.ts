import { loginResponseSchema, type LoginRequest, type LoginResponse } from '@linkby/shared';
import { request } from '@/lib/http';

// Unauthenticated on purpose: its 401 answers for the credentials submitted, not for a session.
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return request('/api/auth/login', loginResponseSchema, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}
