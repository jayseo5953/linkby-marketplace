import { OFFER_SIDES, PRODUCT_STATUSES } from '@linkby/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const productStatus = pgEnum('product_status', PRODUCT_STATUSES);
export const offerSide = pgEnum('offer_side', OFFER_SIDES);

export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`)],
);

export const products = pgTable(
  'products',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    sellerId: bigint('seller_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    status: productStatus('status').notNull().default('Available'),
    buyerId: bigint('buyer_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'restrict',
    }),
    imageKeys: text('image_keys')
      .array()
      .notNull()
      .default(sql`'{}'`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('products_price_cents_positive', sql`${table.priceCents} > 0`),
    check('products_image_keys_max', sql`cardinality(${table.imageKeys}) <= 5`),
    // Biconditional, not an implication: an Available product must have no buyer, and a
    // Reserved or Sold one must have exactly one.
    check(
      'products_buyer_matches_status',
      sql`(${table.status} = 'Available') = (${table.buyerId} is null)`,
    ),
    check(
      'products_buyer_not_seller',
      sql`${table.buyerId} is null or ${table.buyerId} <> ${table.sellerId}`,
    ),
    index('products_status_created_at_idx').on(table.status, table.createdAt.desc()),
  ],
);

export const offers = pgTable(
  'offers',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    // Identifies the negotiation, not the author: a seller's counter-offer still carries
    // the buyer's id. `made_by` says who wrote it.
    buyerId: bigint('buyer_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    madeBy: offerSide('made_by').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('offers_amount_cents_positive', sql`${table.amountCents} > 0`),
    index('offers_product_buyer_idx').on(table.productId, table.buyerId, table.id.desc()),
  ],
);
