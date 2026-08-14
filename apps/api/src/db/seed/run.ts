import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import { deleteByPrefix, putObject } from '../../storage/client';
import { db, pool } from '../client';
import { offers, products, users } from '../schema';
import {
  products as productFixtures,
  seedPassword,
  users as userFixtures,
  type UserHandle,
} from './fixtures';
import { svgFor } from './image';

/** Turns a missing lookup into a named failure rather than a null the schema rejects later. */
function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

async function uploadImage(
  productId: number,
  name: string,
  index: number,
  total: number,
): Promise<string> {
  const key = `products/${productId}/${randomUUID()}.svg`;
  await putObject(key, svgFor(name, index, total), 'image/svg+xml');
  return key;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  if (force) {
    await db.execute(sql`truncate users, products, offers restart identity cascade`);
    // Clear related images
    const removed = await deleteByPrefix('products/');
    logger.info(`cleared ${removed} objects from the bucket`);
  } else {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) {
      logger.info('database already seeded — skipping (pass --force to reseed)');
      await pool.end();
      return;
    }
  }

  // Stage 1 — accounts, so every handle the later stages mention has an id to resolve to.
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const insertedUsers = await db
    .insert(users)
    .values(userFixtures.map(({ email, displayName }) => ({ email, displayName, passwordHash })))
    .returning({ id: users.id, email: users.email });

  // Rows are matched on their natural key rather than on position, so nothing depends on
  // the driver returning them in the order they were sent.
  const userIdByHandle = new Map<UserHandle, number>(
    userFixtures.map((user) => [
      user.handle,
      must(
        insertedUsers.find((row) => row.email === user.email),
        `user was not inserted: ${user.email}`,
      ).id,
    ]),
  );
  const userId = (handle: UserHandle): number =>
    must(userIdByHandle.get(handle), `fixtures name an unknown user handle: ${handle}`);

  // Stage 2 — products, in one statement so ids follow fixture order and the matrix in
  // tasks.md reads the same as the table.
  const insertedProducts = await db
    .insert(products)
    .values(
      productFixtures.map((product) => ({
        sellerId: userId(product.seller),
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        status: product.status ?? 'Available',
        buyerId: product.buyer ? userId(product.buyer) : null,
      })),
    )
    .returning({ id: products.id, name: products.name });

  // Each fixture carries its new id from here on, so the later stages never look one up.
  const seeded = productFixtures.map((product) => ({
    product,
    id: must(
      insertedProducts.find((row) => row.name === product.name),
      `product was not inserted: ${product.name}`,
    ).id,
  }));

  // Stage 3 — placeholder images, uploaded before their keys are written, so a row never
  // names an object that does not exist yet.
  const uploaded = await Promise.all(
    seeded.map(async ({ product, id }) => ({
      id,
      keys: await Promise.all(
        Array.from({ length: product.imageCount }, (_, index) =>
          uploadImage(id, product.name, index, product.imageCount),
        ),
      ),
    })),
  );

  await Promise.all(
    uploaded
      .filter(({ keys }) => keys.length > 0)
      .map(({ id, keys }) => db.update(products).set({ imageKeys: keys }).where(eq(products.id, id))),
  );

  // Stage 4 — offers, all measured from one instant so the relative ordering the fixtures
  // describe cannot drift while the seed runs.
  const seededAt = Date.now();
  const offerRows = seeded.flatMap(({ product, id }) =>
    product.offers.map((offer) => ({
      productId: id,
      buyerId: userId(offer.buyer),
      madeBy: offer.by,
      amountCents: offer.cents,
      createdAt: new Date(seededAt - offer.minutesAgo * 60_000),
    })),
  );
  if (offerRows.length > 0) {
    await db.insert(offers).values(offerRows);
  }

  const imageCount = uploaded.reduce((total, { keys }) => total + keys.length, 0);
  logger.info(
    `seeded ${userFixtures.length} users, ${productFixtures.length} products, ${offerRows.length} offers, ${imageCount} images`,
  );
  // Without this the pool's idle sockets keep the process alive, and the seed container
  // would never exit for Compose's service_completed_successfully gate.
  await pool.end();
}

main().catch((error) => {
  logger.error({ err: error }, 'seed failed');
  process.exit(1);
});
