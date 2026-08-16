import type {
  CreateOfferRequest,
  OfferListItemResponse,
  OfferResponse,
  ProductDetailResponse,
  SessionUser,
} from '@linkby/shared';
import { db } from '../db/client';
import {
  NegotiationRefusal,
  type OfferEntity,
  ProductPolicy,
  RespondRefusal,
} from '../domain/product-policy';
import { ConflictError, NotFoundError } from '../lib/errors';
import * as offerRepo from '../repositories/offer.repo';
import * as productRepo from '../repositories/product.repo';
import { getProduct } from './product';

const NEGOTIATION_MESSAGES: Record<NegotiationRefusal, string> = {
  [NegotiationRefusal.OwnProduct]: 'You cannot negotiate on your own product',
  [NegotiationRefusal.NotAvailable]: 'This product is no longer available to negotiate on',
  [NegotiationRefusal.ThreadOpen]: 'You already have a negotiation open on this product',
};

const RESPOND_MESSAGES: Record<RespondRefusal, string> = {
  [RespondRefusal.NotAvailable]: 'This product is no longer available to negotiate on',
  [RespondRefusal.Superseded]: 'A newer offer has been made in this negotiation',
  [RespondRefusal.NotYourTurn]: 'It is not your turn to respond in this negotiation',
};

function toResponse(offer: OfferEntity): OfferResponse {
  return { ...offer, createdAt: offer.createdAt.toISOString() };
}

function resolveThread(
  viewer: SessionUser,
  policy: ProductPolicy,
  inReplyToOfferId: number | undefined,
): number {
  if (inReplyToOfferId === undefined) {
    const refusal = policy.refusalToStartNegotiation();
    if (refusal) throw new ConflictError(NEGOTIATION_MESSAGES[refusal], refusal);

    return viewer.id;
  }

  const answered = policy.offerById(inReplyToOfferId);
  if (answered === undefined) {
    throw new NotFoundError(`No offer with id ${inReplyToOfferId} on this product`);
  }

  const refusal = policy.refusalToRespond(answered);
  if (refusal) throw new ConflictError(RESPOND_MESSAGES[refusal], refusal);

  return answered.buyerId;
}

export async function listOffers(
  viewer: SessionUser,
  productId: number,
): Promise<OfferListItemResponse[]> {
  const product = await productRepo.findById(productId);
  if (!product) throw new NotFoundError(`No product with id ${productId}`);

  const offers = await offerRepo.findByProduct(productId);
  const policy = new ProductPolicy({ viewer, product, offers });

  return offers.map((offer) => ({
    id: offer.id,
    // The thread's owner, which is the name the whole feed is read by (§5.1).
    buyer: { id: offer.buyerId, displayName: offer.buyerDisplayName },
    madeBy: offer.madeBy,
    amountCents: offer.amountCents,
    createdAt: offer.createdAt.toISOString(),
    isLatestInThread: policy.isNewestInThread(offer),
    isAccepted: policy.wasAccepted(offer),
    canRespond: policy.canRespondTo(offer),
  }));
}

export async function createOffer(
  viewer: SessionUser,
  productId: number,
  { amountCents, inReplyToOfferId }: CreateOfferRequest,
): Promise<OfferResponse> {
  return db.transaction(async (tx) => {
    const product = await productRepo.lockById(productId, tx);
    if (!product) throw new NotFoundError(`No product with id ${productId}`);

    const offers = await offerRepo.findByProduct(productId, tx);
    const policy = new ProductPolicy({ viewer, product, offers });
    const buyerId = resolveThread(viewer, policy, inReplyToOfferId);

    const offer = await offerRepo.insert(
      { productId, buyerId, madeBy: policy.isSeller ? 'seller' : 'buyer', amountCents },
      tx,
    );

    return toResponse(offer);
  });
}

export async function acceptOffer(
  viewer: SessionUser,
  offerId: number,
): Promise<ProductDetailResponse> {
  // Unlocked: offers are immutable, and what varies with time is re-read inside the lock.
  const target = await offerRepo.findById(offerId);
  if (target === undefined) throw new NotFoundError(`No offer with id ${offerId}`);

  await db.transaction(async (tx) => {
    const product = await productRepo.lockById(target.productId, tx);
    if (!product) throw new NotFoundError(`No product with id ${target.productId}`);

    const offers = await offerRepo.findByProduct(target.productId, tx);
    const policy = new ProductPolicy({ viewer, product, offers });
    const refusal = policy.refusalToRespond(target);
    if (refusal) throw new ConflictError(RESPOND_MESSAGES[refusal], refusal);

    await productRepo.markReserved(
      target.productId,
      { buyerId: target.buyerId, finalPriceCents: target.amountCents },
      tx,
    );
  });

  return getProduct(viewer, target.productId);
}
