import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, BookmarkCheck, CircleAlert, Store } from 'lucide-react';
import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import * as productsApi from '@/api/products';
import { hasActions, ProductActionPanel } from '@/components/products/product-action-panel';
import { ProductImages } from '@/components/products/product-images';
import { ProductStatusBadge } from '@/components/products/product-status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { ApiError } from '@/lib/http';
import { ROUTES } from '@/lib/routes';

export function ProductDetailsPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();

  const productId = Number(id);
  const idIsUsable = Number.isInteger(productId) && productId > 0;
  // Set synchronously: a double-click fires twice before `isPending` has re-rendered the button.
  const inFlight = useRef(false);

  const product = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsApi.getProduct(productId),
    enabled: idIsUsable,
  });

  const purchase = useMutation({
    mutationFn: () => productsApi.purchaseProduct(productId),
    onSuccess: () => navigate(ROUTES.products),
    // The refetch re-renders the screen as it truly is now, so the toast only has to say the click did nothing.
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Couldn't reach the server to buy this product",
        { description: 'Your purchase was not completed.' },
      );
      void product.refetch();
    },
    onSettled: () => {
      inFlight.current = false;
    },
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

  const { name, status, priceCents, description, seller, buyerId, imageUrls } = product.data;
  const viewerIsSeller = session?.user.id === seller.id;
  const reservedForViewer = status === 'Reserved' && session?.user.id === buyerId;
  const isClosedToViewer = status !== 'Available' && !viewerIsSeller && !reservedForViewer;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={ROUTES.products}
        className="text-muted-foreground flex w-fit items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div
          className={`flex flex-col gap-6 ${hasActions(product.data) ? 'lg:col-span-2' : 'lg:col-span-3'}`}
        >
          <div className="flex flex-col gap-2">
            {viewerIsSeller && (
              <Alert>
                <Store />
                <AlertTitle>This is your listing.</AlertTitle>
              </Alert>
            )}

            {reservedForViewer && (
              <Alert>
                <BookmarkCheck />
                <AlertTitle>This product is reserved for you.</AlertTitle>
                <AlertDescription>You can now proceed to purchase.</AlertDescription>
              </Alert>
            )}

            {isClosedToViewer && (
              <Alert>
                <Ban />
                <AlertTitle>This product is no longer available.</AlertTitle>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl font-medium">{name}</h1>
              <ProductStatusBadge status={status} />
            </div>
            <p className="font-medium">Listed price: {formatPrice(priceCents)}</p>
            <p className="text-muted-foreground text-sm">Seller: {seller.displayName}</p>
          </div>

          <p className="whitespace-pre-line">{description}</p>

          <ProductImages name={name} imageUrls={imageUrls} />
        </div>

        <ProductActionPanel
          product={product.data}
          isWorking={purchase.isPending}
          onPurchase={() => {
            if (inFlight.current) return;

            inFlight.current = true;
            purchase.mutate();
          }}
        />
      </div>
    </div>
  );
}
