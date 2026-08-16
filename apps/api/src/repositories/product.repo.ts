import { PAGE_SIZE, PRODUCT_VIEWS, type ProductView } from '@linkby/shared';
import { and, count, desc, eq, ilike, type SQL } from 'drizzle-orm';
import { db, type Tx } from '../db/client';
import { products, users } from '../db/schema';
import type { ProductEntity } from '../domain/product-policy';

export type ProductRow = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  status: (typeof products.status.enumValues)[number];
  // Both the joined seller and the raw column: the display name renders, the id decides policy.
  sellerId: number;
  seller: { id: number; displayName: string };
  buyerId: number | null;
  finalPriceCents: number | null;
  imageKeys: string[];
  createdAt: Date;
};

const columns = {
  id: products.id,
  name: products.name,
  description: products.description,
  priceCents: products.priceCents,
  status: products.status,
  sellerId: products.sellerId,
  seller: { id: users.id, displayName: users.displayName },
  buyerId: products.buyerId,
  finalPriceCents: products.finalPriceCents,
  imageKeys: products.imageKeys,
  createdAt: products.createdAt,
};

type ListFilters = { view: ProductView; q: string; page: number; viewerId: number };

function viewCondition(view: ProductView, viewerId: number): SQL | undefined {
  switch (view) {
    case PRODUCT_VIEWS.Available:
      return eq(products.status, 'Available');
    case PRODUCT_VIEWS.Reserved:
      return eq(products.status, 'Reserved');
    case PRODUCT_VIEWS.Sold:
      return eq(products.status, 'Sold');
    case PRODUCT_VIEWS.ListedByMe:
      return eq(products.sellerId, viewerId);
    // Not buyer alone: a Sold product keeps its buyer, and those are bought, not awaiting purchase.
    case PRODUCT_VIEWS.ReservedForMe:
      return and(eq(products.buyerId, viewerId), eq(products.status, 'Reserved'));
    case PRODUCT_VIEWS.All:
      return undefined;
  }
}

// Joined rather than looked up per row, so the seller name costs no extra round trip (§5).
export async function findPage(filters: ListFilters): Promise<{ rows: ProductRow[]; total: number }> {
  const { view, q, page, viewerId } = filters;
  // Name only: matching description text would surface listings whose names look unrelated.
  const where = and(
    viewCondition(view, viewerId),
    q === '' ? undefined : ilike(products.name, `%${q}%`),
  );

  const [rows, totals] = await Promise.all([
    db
      .select(columns)
      .from(products)
      .innerJoin(users, eq(users.id, products.sellerId))
      // Ordering is not a core concern (§2), but a list endpoint still has to be deterministic.
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .where(where),
    // Counted without the join: the seller is not part of the predicate, so joining would only cost.
    db.select({ value: count() }).from(products).where(where),
  ]);

  return { rows, total: totals[0]?.value ?? 0 };
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

// Unjoined: `for update` across a join would lock the seller's row and serialise their catalogue.
export async function lockById(id: number, tx: Tx): Promise<ProductEntity | undefined> {
  const rows = await tx.select().from(products).where(eq(products.id, id)).for('update').limit(1);

  return rows[0];
}

// Both take a `Tx` rather than an `Executor`: neither is correct outside the `lockById` that
// decided the transition was allowed, so the pool is not an option worth offering.
export async function markReserved(
  id: number,
  values: { buyerId: number; finalPriceCents: number },
  tx: Tx,
): Promise<void> {
  await tx.update(products).set({ status: 'Reserved', ...values }).where(eq(products.id, id));
}

export async function markSold(
  id: number,
  values: { buyerId: number; finalPriceCents: number },
  tx: Tx,
): Promise<void> {
  await tx.update(products).set({ status: 'Sold', ...values }).where(eq(products.id, id));
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
