import type { CreateOfferRequest, OfferResponse, SessionUser } from '@linkby/shared';
import { db } from '../db/client';
import { type OfferEntity, ProductPolicy } from '../domain/product-policy';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/errors';
import * as offerRepo from '../repositories/offer.repo';
import * as productRepo from '../repositories/product.repo';
import { buildPolicyInput } from './product';

function toResponse(offer: OfferEntity): OfferResponse {
  return { ...offer, createdAt: offer.createdAt.toISOString() };
}

export async function createOffer(
  viewer: SessionUser,
  productId: number,
  { amountCents, buyerId }: CreateOfferRequest,
): Promise<OfferResponse> {
  return db.transaction(async (tx) => {
    const product = await productRepo.lockById(productId, tx);
    if (!product) throw new NotFoundError(`No product with id ${productId}`);

    const policy = new ProductPolicy(await buildPolicyInput(viewer, product, tx));

    // Which thread a request may address is a matter of its shape, not of the product's state, so
    // it leaves as a 400 rather than joining the policy's refusals.
    const namingMatchesRole = policy.isSeller === (buyerId !== undefined);
    if (!namingMatchesRole) {
      throw new BadRequestError(
        policy.isSeller
          ? 'A counter must name the buyer whose thread it answers'
          : 'An offer on your own thread must not name a buyer',
        'THREAD_NAMING_INVALID',
      );
    }

    const threadBuyerId = buyerId ?? viewer.id;
    const newest = policy.newestInThread(threadBuyerId);
    const allowed = newest ? policy.canCounter(newest) : policy.canStartNegotiation;

    if (!allowed) {
      throw new ConflictError(
        'You cannot make an offer on this product right now',
        'OFFER_NOT_ALLOWED',
      );
    }

    const offer = await offerRepo.insert(
      { productId, buyerId: threadBuyerId, madeBy: policy.isSeller ? 'seller' : 'buyer', amountCents },
      tx,
    );

    return toResponse(offer);
  });
}
