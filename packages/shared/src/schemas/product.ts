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

export const productResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int().positive(),
  status: z.enum(PRODUCT_STATUSES),
  // Narrower than `sessionUserSchema` on purpose: a seller's email is not every viewer's business.
  seller: z.object({ id: z.number().int().positive(), displayName: z.string() }),
  imageUrls: z.array(z.string()),
  createdAt: z.string(),
});

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
