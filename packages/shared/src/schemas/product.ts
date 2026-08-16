import { z } from 'zod';
import { PRODUCT_STATUSES } from '../domain/product';
import { positiveIntFromText } from './primitives';

/**
 * The product contract. Limits are constants rather than a shared validator because each side
 * enforces them differently — the API inside its multipart parser, the browser before upload
 * (T-47) — so a predicate would only ever run on one of the two paths.
 */

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// SVG is excluded: it carries script, and the bucket serves what it is given to anyone (T-74).
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;

export const createProductRequestSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH),
  // Cents: the API parses a wire format and never converts a unit. The browser turns what the
  // user typed into cents, where the raw string still exists (T-60).
  priceCents: positiveIntFromText,
});

// Narrower than `sessionUserSchema` on purpose: a seller's email is not every viewer's business.
const sellerSchema = z.object({ id: z.number().int().positive(), displayName: z.string() });

export const productResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int().positive(),
  status: z.enum(PRODUCT_STATUSES),
  seller: sellerSchema,
  buyerId: z.number().int().positive().nullable(),
  // What the sale settled at. Null until there is a sale; never overwrites the listed price (§2.4).
  finalPriceCents: z.number().int().positive().nullable(),
  imageUrls: z.array(z.string()),
  createdAt: z.string(),
});

/**
 * What this viewer may do with this product, decided by the server so that the rules exist in one
 * place and the browser holds no copy of them (T-54).
 */
export const productViewerSchema = z.object({
  canPurchase: z.boolean(),
  // The amount Purchase would charge, so the button's label cannot drift from it.
  purchasePriceCents: z.number().int().positive().nullable(),
  // The opening Counter Offer button. Per-row controls belong to the history, not to the product.
  canStartNegotiation: z.boolean(),
});

export const productDetailResponseSchema = productResponseSchema.extend({
  viewer: productViewerSchema,
});

// The card in §3.2, which shows one image and never the description.
export const productListItemResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  priceCents: z.number().int().positive(),
  status: z.enum(PRODUCT_STATUSES),
  seller: sellerSchema,
  buyerId: z.number().int().positive().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
});

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type ProductViewer = z.infer<typeof productViewerSchema>;
export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>;
export type ProductListItemResponse = z.infer<typeof productListItemResponseSchema>;
