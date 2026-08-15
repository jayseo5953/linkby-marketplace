import { db } from '../db/client';
import { products } from '../db/schema';

export async function insert(values: {
  sellerId: number;
  name: string;
  description: string;
  priceCents: number;
  imageKeys: string[];
}): Promise<{ id: number; createdAt: Date }> {
  const rows = await db
    .insert(products)
    .values(values)
    .returning({ id: products.id, createdAt: products.createdAt });

  // `returning` on a single-row insert cannot come back empty; the index keeps the type honest.
  return rows[0]!;
}
