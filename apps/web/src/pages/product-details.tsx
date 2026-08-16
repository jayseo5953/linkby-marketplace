import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Link, useParams } from 'react-router';
import * as productsApi from '@/api/products';
import { ProductImages } from '@/components/products/product-images';
import { ProductStatusBadge } from '@/components/products/product-status-badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { ApiError } from '@/lib/http';
import { ROUTES } from '@/lib/routes';

export function ProductDetailsPage() {
  const { id } = useParams();
  const { session } = useAuth();

  const productId = Number(id);
  const idIsUsable = Number.isInteger(productId) && productId > 0;

  const product = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsApi.getProduct(productId),
    enabled: idIsUsable,
  });

  const isMissing =
    !idIsUsable || (product.error instanceof ApiError && product.error.status === 404);

  if (isMissing) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p>That product doesn't exist.</p>
        <Button asChild variant="outline">
          <Link to={ROUTES.products}>Back to products</Link>
        </Button>
      </div>
    );
  }

  if (product.isPending) {
    return <p className="text-muted-foreground text-sm">Loading product…</p>;
  }

  if (product.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
          <CircleAlert className="size-4 shrink-0" />
          Couldn't load this product.
        </p>
        <Button variant="outline" onClick={() => void product.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const { name, status, priceCents, description, seller, imageUrls } = product.data;
  const viewerIsSeller = session?.user.id === seller.id;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={ROUTES.products}
        className="text-muted-foreground flex w-fit items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-medium">{name}</h1>
          <ProductStatusBadge status={status} />
        </div>
        <p className="font-medium">Listed price: {formatPrice(priceCents)}</p>
        <p className="text-muted-foreground text-sm">
          {viewerIsSeller ? 'You are the seller of this item.' : `Seller: ${seller.displayName}`}
        </p>
      </div>

      <p className="whitespace-pre-line">{description}</p>

      <ProductImages name={name} imageUrls={imageUrls} />
    </div>
  );
}
