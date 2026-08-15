import { asc, eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { offers } from '../db/schema';
import type { OfferEntity } from '../domain/product-policy';

// Oldest first, which is the order the history renders in.
export async function findByProduct(
  productId: number,
  exec: Executor = db,
): Promise<OfferEntity[]> {
  return exec.select().from(offers).where(eq(offers.productId, productId)).orderBy(asc(offers.id));
}

export async function findById(id: number, exec: Executor = db): Promise<OfferEntity | undefined> {
  const rows = await exec.select().from(offers).where(eq(offers.id, id)).limit(1);

  return rows[0];
}

export async function insert(
  values: Pick<OfferEntity, 'productId' | 'buyerId' | 'madeBy' | 'amountCents'>,
  exec: Executor = db,
): Promise<OfferEntity> {
  const rows = await exec.insert(offers).values(values).returning();

  // `returning` on a single-row insert cannot come back empty; the index keeps the type honest.
  return rows[0]!;
}
