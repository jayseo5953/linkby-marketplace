import { loginResponseSchema, type LoginResponse } from '@linkby/shared';

const STORAGE_KEY = 'linkby.session';

export type Session = LoginResponse;

export function readStoredSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  // Anything else in this key is somebody else's data or a leftover from an older shape.
  try {
    const parsed = loginResponseSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function storeSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
