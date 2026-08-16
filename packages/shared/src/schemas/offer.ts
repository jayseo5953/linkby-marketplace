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

/**
 * A row of the product's offer feed: every thread interleaved, shown to every viewer (§3.4). The
 * two flags are the §5.5 gates, which the browser holds no copy of (T-54).
 */
export const offerListItemResponseSchema = z.object({
  id: z.number().int().positive(),
  // The thread's owner, not the author, which is what lets one flat feed hold several threads.
  buyer: z.object({ id: z.number().int().positive(), displayName: z.string() }),
  madeBy: z.enum(OFFER_SIDES),
  amountCents: z.number().int().positive(),
  createdAt: z.string(),
  isLatestInThread: z.boolean(),
  // One flag: accepting and countering appear and disappear together (T-65).
  canRespond: z.boolean(),
});

export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;
export type OfferResponse = z.infer<typeof offerResponseSchema>;
export type OfferListItemResponse = z.infer<typeof offerListItemResponseSchema>;
