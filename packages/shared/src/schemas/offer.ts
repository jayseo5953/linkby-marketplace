import { z } from 'zod';
import { OFFER_SIDES } from '../domain/product';

// Absent opens a thread, present counters that offer. The shape says which act this is rather than
// who the caller is, and the thread follows from the offer instead of being asserted (T-64).
export const createOfferRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  inReplyToOfferId: z.number().int().positive().optional(),
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
