import { z } from 'zod';
import { PRODUCT_STATUSES } from '../domain/product';

/**
 * The product contract. Limits are constants rather than a shared validator because each side
 * enforces them differently — the API inside its multipart parser, the browser before upload
 * (T-47) — so a predicate would only ever run on one of the two paths.
 */

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

// Split rather than multiplied, so a price never passes through a float on its way to cents.
function toCents(value: string): number {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export const createProductRequestSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  // A multipart text field is always a string, so the decimal is parsed here rather than coerced.
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Price must be a number with at most two decimal places')
    .transform(toCents)
    .refine((cents) => cents > 0, 'Price must be greater than zero'),
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
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
});

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type ProductViewer = z.infer<typeof productViewerSchema>;
export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>;
export type ProductListItemResponse = z.infer<typeof productListItemResponseSchema>;
