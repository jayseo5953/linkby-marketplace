import { eq, sql } from 'drizzle-orm';
import type { SessionUser } from '@linkby/shared';
import { db } from '../db/client';
import { users } from '../db/schema';

// Matched on `lower(email)` because that is what `users_email_lower_unique` makes unique.
export async function findByEmail(
  email: string,
): Promise<{ id: number; email: string; displayName: string; passwordHash: string } | undefined> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);

  return rows[0];
}

// Hash left out of the selection, so it cannot reach a response body even if a row is returned whole.
export async function findById(id: number): Promise<SessionUser | undefined> {
  const rows = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return rows[0];
}
