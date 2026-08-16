import {
  productDetailResponseSchema,
  productListItemResponseSchema,
  productResponseSchema,
  type CreateProductRequest,
  type ProductDetailResponse,
  type ProductListItemResponse,
  type ProductResponse,
} from '@linkby/shared';
import { z } from 'zod';
import { authedRequest } from '@/lib/http';

export async function listProducts(): Promise<ProductListItemResponse[]> {
  return authedRequest('/api/products', z.array(productListItemResponseSchema));
}

export async function getProduct(id: number): Promise<ProductDetailResponse> {
  return authedRequest(`/api/products/${id}`, productDetailResponseSchema);
}

export async function createProduct(
  product: CreateProductRequest,
  images: File[],
): Promise<ProductResponse> {
  const body = new FormData();
  body.set('name', product.name);
  body.set('description', product.description);
  body.set('priceCents', String(product.priceCents));
  images.forEach((image) => body.append('images', image));

  return authedRequest('/api/products', productResponseSchema, { method: 'POST', body });
}
