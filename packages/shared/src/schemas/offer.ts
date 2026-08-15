import { z } from 'zod';
import { OFFER_SIDES } from '../domain/product';

// A buyer has one thread and never names it; a seller always answers somebody's and always does.
// A buyer sending `buyerId` is refused, since accepting it would write into another thread (T-58).
export const createOfferRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  buyerId: z.number().int().positive().optional(),
});

export const offerResponseSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  // The thread's owner, not the author — a seller's counter still carries the buyer's id.
  buyerId: z.number().int().positive(),
  madeBy: z.enum(OFFER_SIDES),
  amountCents: z.number().int().positive(),
  createdAt: z.string(),
});

export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;
export type OfferResponse = z.infer<typeof offerResponseSchema>;
