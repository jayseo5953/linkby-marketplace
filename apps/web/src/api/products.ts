import {
  productDetailResponseSchema,
  productPageResponseSchema,
  productResponseSchema,
  type CreateProductRequest,
  type ListProductsQuery,
  type ProductDetailResponse,
  type ProductPageResponse,
  type ProductResponse,
} from '@linkby/shared';
import { authedRequest } from '@/lib/http';

export async function listProducts(query: ListProductsQuery): Promise<ProductPageResponse> {
  const params = new URLSearchParams({
    view: query.view,
    q: query.q,
    page: String(query.page),
  });

  return authedRequest(`/api/products?${params}`, productPageResponseSchema);
}

export async function getProduct(id: number): Promise<ProductDetailResponse> {
  return authedRequest(`/api/products/${id}`, productDetailResponseSchema);
}

export async function purchaseProduct(id: number): Promise<ProductDetailResponse> {
  return authedRequest(`/api/products/${id}/purchase`, productDetailResponseSchema, {
    method: 'POST',
  });
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
