import type { ProductListItemResponse } from '@linkby/shared';
import { Package } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import { productDetailPath } from '@/lib/routes';

// Weight tracks how settled the state is: an outline for Available, solid for Sold.
const STATUS_BADGES: Record<
  ProductListItemResponse['status'],
  'default' | 'secondary' | 'outline'
> = {
  Available: 'outline',
  Reserved: 'secondary',
  Sold: 'default',
};

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
          <CardTitle>{product.name}</CardTitle>
          <p className="font-medium">{formatPrice(product.priceCents)}</p>
          <p className="text-muted-foreground">Seller: {product.seller.displayName}</p>
        </CardContent>

        <CardFooter className="mt-auto justify-end">
          <Badge variant={STATUS_BADGES[product.status]}>{product.status}</Badge>
        </CardFooter>
      </Card>
    </Link>
  );
}
