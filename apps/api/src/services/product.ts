import { randomUUID } from 'node:crypto';
import type { CreateProductRequest, ProductResponse, SessionUser } from '@linkby/shared';
import { logger } from '../lib/logger';
import * as productRepo from '../repositories/product.repo';
import { deleteObjects, publicUrl, putObject } from '../storage/client';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

// Flat keys: nothing needs the product id, and not needing it is what lets the upload run first (T-45).
function keyFor(mimetype: string): string {
  return `products/${randomUUID()}.${EXTENSIONS[mimetype] ?? 'bin'}`;
}

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
    imageUrls: imageKeys.map(publicUrl),
    createdAt: created.createdAt.toISOString(),
  };
}
