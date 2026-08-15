import type {
  CreateOfferRequest,
  OfferResponse,
  ProductDetailResponse,
  SessionUser,
} from '@linkby/shared';
import { db } from '../db/client';
import { type OfferEntity, ProductPolicy, type RespondRefusal } from '../domain/product-policy';
import { ConflictError, NotFoundError } from '../lib/errors';
import * as offerRepo from '../repositories/offer.repo';
import * as productRepo from '../repositories/product.repo';
import { buildPolicyInput, getProduct } from './product';

const REFUSALS: Record<RespondRefusal, { message: string; code: string }> = {
  'not-available': {
    message: 'This product is no longer available to negotiate on',
    code: 'PRODUCT_NOT_AVAILABLE',
  },
  superseded: {
    message: 'A newer offer has been made in this negotiation',
    code: 'OFFER_SUPERSEDED',
  },
  'not-your-turn': {
    message: 'It is not your turn to respond in this negotiation',
    code: 'NOT_YOUR_TURN',
  },
};

function toResponse(offer: OfferEntity): OfferResponse {
  return { ...offer, createdAt: offer.createdAt.toISOString() };
}

function refusalError(refusal: RespondRefusal): ConflictError {
  const { message, code } = REFUSALS[refusal];
  return new ConflictError(message, code);
}

/** The thread the offer belongs in, or the refusal that stops it being written at all. */
function resolveThread(
  viewer: SessionUser,
  policy: ProductPolicy,
  inReplyToOfferId: number | undefined,
): number {
  if (inReplyToOfferId === undefined) {
    if (policy.canStartNegotiation) return viewer.id;
    throw new ConflictError(
      'You cannot open a negotiation on this product',
      'NEGOTIATION_NOT_ALLOWED',
    );
  }

  const answered = policy.offerById(inReplyToOfferId);
  if (answered === undefined) {
    throw new NotFoundError(`No offer with id ${inReplyToOfferId} on this product`);
  }

  const refusal = policy.refusalToRespond(answered);
  if (refusal) throw refusalError(refusal);

  return answered.buyerId;
}

export async function createOffer(
  viewer: SessionUser,
  productId: number,
  { amountCents, inReplyToOfferId }: CreateOfferRequest,
): Promise<OfferResponse> {
  return db.transaction(async (tx) => {
    const product = await productRepo.lockById(productId, tx);
    if (!product) throw new NotFoundError(`No product with id ${productId}`);

    const policy = new ProductPolicy(await buildPolicyInput(viewer, product, tx));
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
  // Offers are immutable, so this read needs no lock — everything that varies with time is the
  // product's status and which offer is newest, and both are read inside the lock below.
  const target = await offerRepo.findById(offerId);
  if (target === undefined) throw new NotFoundError(`No offer with id ${offerId}`);

  await db.transaction(async (tx) => {
    const product = await productRepo.lockById(target.productId, tx);
    if (!product) throw new NotFoundError(`No product with id ${target.productId}`);

    const policy = new ProductPolicy(await buildPolicyInput(viewer, product, tx));
    const refusal = policy.refusalToRespond(target);
    if (refusal) throw refusalError(refusal);

    await productRepo.markReserved(
      target.productId,
      { buyerId: target.buyerId, finalPriceCents: target.amountCents },
      tx,
    );
  });

  return getProduct(viewer, target.productId);
}
