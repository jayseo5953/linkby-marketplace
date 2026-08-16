import { randomUUID } from 'node:crypto';
import type {
  CreateProductRequest,
  ProductDetailResponse,
  ProductListItemResponse,
  ProductResponse,
  SessionUser,
} from '@linkby/shared';
import { db, type Executor } from '../db/client';
import {
  type ProductEntity,
  ProductPolicy,
  PurchaseRefusal,
} from '../domain/product-policy';
import { ConflictError, NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';
import * as offerRepo from '../repositories/offer.repo';
import * as productRepo from '../repositories/product.repo';
import { deleteObjects, publicUrl, putObject } from '../storage/client';

const PURCHASE_MESSAGES: Record<PurchaseRefusal, string> = {
  [PurchaseRefusal.OwnProduct]: 'You cannot buy your own product',
  [PurchaseRefusal.NotAvailable]: 'This product is no longer available',
  [PurchaseRefusal.NegotiationOpen]:
    'Settle your open negotiation on this product before buying it',
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};


export async function createProduct(
  seller: SessionUser,
  { name, description, priceCents }: CreateProductRequest,
  images: Express.Multer.File[],
): Promise<ProductResponse> {
  // insert images first to storage
  const imageKeys = await storeImages(images);

  // insert product row
  const created = await productRepo
    .insert({ sellerId: seller.id, name, description, priceCents, imageKeys })
    .catch(async (error: unknown) => {
      // Objects exist and the row does not, so they are unreachable — drop them and report the
      // insert failure, not whatever the cleanup does (T-44).
      await discard(imageKeys);
      throw error;
    });

  return {
    id: created.id,
    name,
    description,
    priceCents,
    status: 'Available',
    seller: { id: seller.id, displayName: seller.displayName },
    buyerId: null,
    finalPriceCents: null,
    imageUrls: imageKeys.map(publicUrl),
    createdAt: created.createdAt.toISOString(),
  };
}

export async function listProducts(): Promise<ProductListItemResponse[]> {
  const rows = await productRepo.findAll();

  return rows.map(({ id, name, priceCents, status, seller, imageKeys, createdAt }) => ({
    id,
    name,
    priceCents,
    status,
    seller,
    imageUrl: imageKeys.map(publicUrl).at(0) ?? null,
    createdAt: createdAt.toISOString(),
  }));
}

export async function getProduct(viewer: SessionUser, id: number): Promise<ProductDetailResponse> {
  const row = await productRepo.findById(id);
  if (!row) throw new NotFoundError(`No product with id ${id}`);

  const offers = await offerRepo.findByProduct(id);
  const policy = new ProductPolicy({ viewer, product: row, offers });
  const { sellerId, imageKeys, createdAt, ...rest } = row;

  return {
    ...rest,
    imageUrls: imageKeys.map(publicUrl),
    createdAt: createdAt.toISOString(),
    viewer: policy.toViewer(),
  };
}

export async function purchaseProduct(
  viewer: SessionUser,
  id: number,
): Promise<ProductDetailResponse> {
  await db.transaction(async (tx) => {
    const product = await productRepo.lockById(id, tx);
    if (!product) throw new NotFoundError(`No product with id ${id}`);

    const offers = await offerRepo.findByProduct(id, tx);
    const policy = new ProductPolicy({ viewer, product, offers });
    const refusal = policy.refusalToPurchase();
    if (refusal) throw new ConflictError(PURCHASE_MESSAGES[refusal], refusal);

    // Non-null by `canPurchase`, which is the only thing that can produce a price here.
    await productRepo.markSold(
      id,
      { buyerId: viewer.id, finalPriceCents: policy.purchasePriceCents! },
      tx,
    );
  });

  return getProduct(viewer, id);
}

// Settled rather than raced: whatever landed before a failure still has to be cleaned up (T-75).
async function storeImages(images: Express.Multer.File[]): Promise<string[]> {
  const results = await Promise.allSettled(
    images.map(async (image) => {
      const key = keyFor(image.mimetype);
      await putObject(key, image.buffer, image.mimetype);
      return key;
    }),
  );

  const uploaded = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const failed = results.find((result) => result.status === 'rejected');

  if (failed) {
    await discard(uploaded);
    throw failed.reason;
  }

  return uploaded;
}

// Best-effort, so the caller's original error is the one that surfaces.
async function discard(keys: string[]): Promise<void> {
  await deleteObjects(keys).catch((error: unknown) =>
    logger.error({ err: error, keys }, 'orphaned objects left in storage'),
  );
}

// Flat keys: nothing needs the product id, and not needing it is what lets the upload run first (T-45).
function keyFor(mimetype: string): string {
  return `products/${randomUUID()}.${EXTENSIONS[mimetype] ?? 'bin'}`;
}