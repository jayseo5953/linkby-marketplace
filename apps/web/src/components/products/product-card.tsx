import type { ProductListItemResponse } from '@linkby/shared';
import { Package } from 'lucide-react';
import { Link } from 'react-router';
import { ProductStatusBadge } from '@/components/products/product-status-badge';
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import { productDetailPath } from '@/lib/routes';

export function ProductCard({ product }: { product: ProductListItemResponse }) {
  return (
    <Link to={productDetailPath(product.id)} className="block rounded-xl">
      <Card className="h-full pt-0 transition hover:ring-foreground/25">
        <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden bg-muted">
          {product.imageUrl !== null ? (
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="size-8 text-muted-foreground" aria-hidden />
          )}
        </div>

        <CardContent className="flex flex-col gap-1">
          <CardTitle className="truncate" title={product.name}>
            {product.name}
          </CardTitle>
          <p className="font-medium">{formatPrice(product.priceCents)}</p>
          <p className="text-muted-foreground">Seller: {product.seller.displayName}</p>
        </CardContent>

        <CardFooter className="mt-auto justify-end">
          <ProductStatusBadge status={product.status} />
        </CardFooter>
      </Card>
    </Link>
  );
}
