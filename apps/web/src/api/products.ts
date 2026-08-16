import { productListItemResponseSchema, type ProductListItemResponse } from '@linkby/shared';
import { z } from 'zod';
import { authedRequest } from '@/lib/http';

export async function listProducts(): Promise<ProductListItemResponse[]> {
  return authedRequest('/api/products', z.array(productListItemResponseSchema));
}
