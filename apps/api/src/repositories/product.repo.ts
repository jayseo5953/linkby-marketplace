import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { products, users } from '../db/schema';

export type ProductRow = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  status: (typeof products.status.enumValues)[number];
  seller: { id: number; displayName: string };
  buyerId: number | null;
  imageKeys: string[];
  createdAt: Date;
};

const columns = {
  id: products.id,
  name: products.name,
  description: products.description,
  priceCents: products.priceCents,
  status: products.status,
  seller: { id: users.id, displayName: users.displayName },
  buyerId: products.buyerId,
  imageKeys: products.imageKeys,
  createdAt: products.createdAt,
};

// Joined rather than looked up per row, so the seller name costs no extra round trip (§5).
export async function findAll(): Promise<ProductRow[]> {
  return db
    .select(columns)
    .from(products)
    .innerJoin(users, eq(users.id, products.sellerId))
    // Ordering is not a core concern (§2), but a list endpoint still has to be deterministic.
    .orderBy(desc(products.createdAt), desc(products.id));
}

export async function findById(id: number): Promise<ProductRow | undefined> {
  const rows = await db
    .select(columns)
    .from(products)
    .innerJoin(users, eq(users.id, products.sellerId))
    .where(eq(products.id, id))
    .limit(1);

  return rows[0];
}

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
