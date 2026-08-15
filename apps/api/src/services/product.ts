import { randomUUID } from 'node:crypto';
import type {
  CreateProductRequest,
  ProductDetailResponse,
  ProductListItemResponse,
  ProductResponse,
  SessionUser,
} from '@linkby/shared';
import { db, type Executor } from '../db/client';
import { type PolicyInput, type ProductEntity, ProductPolicy } from '../domain/product-policy';
import { ConflictError, NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';
import * as productRepo from '../repositories/product.repo';
import { deleteObjects, publicUrl, putObject } from '../storage/client';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};


export async function createProduct(
  seller: SessionUser,
  { name, description, price }: CreateProductRequest,
  images: Express.Multer.File[],
): Promise<ProductResponse> {
  // insert images first to storage
  const imageKeys = await Promise.all(
    images.map(async (image) => {
      const key = keyFor(image.mimetype);
      await putObject(key, image.buffer, image.mimetype);
      return key;
    }),
  );

  // insert product row
  const created = await productRepo
    .insert({ sellerId: seller.id, name, description, priceCents: price, imageKeys })
    .catch(async (error: unknown) => {
      // Objects exist and the row does not, so they are unreachable — drop them and report the
      // insert failure, not whatever the cleanup does (T-44).
      await deleteObjects(imageKeys).catch((cleanupError: unknown) =>
        logger.error({ err: cleanupError, imageKeys }, 'orphaned objects left in storage'),
      );
      throw error;
    });

  return {
    id: created.id,
    name,
    description,
    priceCents: price,
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

/** The one place a policy input is assembled, so the read and the write cannot feed it differently. */
async function buildPolicyInput(
  viewer: SessionUser,
  product: ProductEntity,
  exec: Executor = db,
): Promise<PolicyInput> {
  return {
    viewer,
    product,
    viewerHasNegotiation: await productRepo.hasOfferFrom(product.id, viewer.id, exec),
  };
}

export async function getProduct(viewer: SessionUser, id: number): Promise<ProductDetailResponse> {
  const row = await productRepo.findById(id);
  if (!row) throw new NotFoundError(`No product with id ${id}`);

  const policy = new ProductPolicy(await buildPolicyInput(viewer, row));
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

    const policy = new ProductPolicy(await buildPolicyInput(viewer, product, tx));
    if (!policy.canPurchase) {
      throw new ConflictError(
        'This product is no longer available for you to purchase',
        'PURCHASE_NOT_ALLOWED',
      );
    }

    // Non-null by `canPurchase`, which is the only thing that can produce a price here.
    await productRepo.markSold(
      id,
      { buyerId: viewer.id, finalPriceCents: policy.purchasePriceCents! },
      tx,
    );
  });

  return getProduct(viewer, id);
}

// Flat keys: nothing needs the product id, and not needing it is what lets the upload run first (T-45).
function keyFor(mimetype: string): string {
  return `products/${randomUUID()}.${EXTENSIONS[mimetype] ?? 'bin'}`;
}