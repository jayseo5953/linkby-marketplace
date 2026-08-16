import {
  offerListItemResponseSchema,
  offerResponseSchema,
  productDetailResponseSchema,
  type CreateOfferRequest,
  type OfferListItemResponse,
  type OfferResponse,
  type ProductDetailResponse,
} from '@linkby/shared';
import { z } from 'zod';
import { authedRequest } from '@/lib/http';

export async function listOffers(productId: number): Promise<OfferListItemResponse[]> {
  return authedRequest(`/api/products/${productId}/offers`, z.array(offerListItemResponseSchema));
}

export async function createOffer(
  productId: number,
  offer: CreateOfferRequest,
): Promise<OfferResponse> {
  return authedRequest(`/api/products/${productId}/offers`, offerResponseSchema, {
    method: 'POST',
    body: JSON.stringify(offer),
  });
}

export async function acceptOffer(offerId: number): Promise<ProductDetailResponse> {
  return authedRequest(`/api/offers/${offerId}/accept`, productDetailResponseSchema, {
    method: 'POST',
  });
}
