import type { CreateOfferRequest } from '@linkby/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, BookmarkCheck, CircleAlert, CircleCheck, Store } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import * as offersApi from '@/api/offers';
import * as productsApi from '@/api/products';
import type { OpenForm } from '@/components/products/negotiation-history';
import { hasActions, ProductActionPanel } from '@/components/products/product-action-panel';
import { ProductImages } from '@/components/products/product-images';
import { ProductStatusBadge } from '@/components/products/product-status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { formatPrice } from '@/lib/format';
import { ApiError } from '@/lib/http';
import { ROUTES } from '@/lib/routes';

function refusal(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function ProductDetailsPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const productId = Number(id);
  const idIsUsable = Number.isInteger(productId) && productId > 0;
  // Set synchronously: a double-click fires twice before `isPending` has re-rendered the button.
  const inFlight = useRef(false);
  const [openForm, setOpenForm] = useState<OpenForm>(null);

  const product = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsApi.getProduct(productId),
    enabled: idIsUsable,
  });

  const offers = useQuery({
    queryKey: ['offers', productId],
    queryFn: () => offersApi.listOffers(productId),
    enabled: idIsUsable,
  });

  const purchase = useMutation({
    mutationFn: () => productsApi.purchaseProduct(productId),
    onSuccess: (bought) => queryClient.setQueryData(['product', productId], bought),
    // The refetch re-renders the screen as it truly is now, so the toast only has to say the click did nothing.
    onError: (error) => {
      toast.error(refusal(error, "Couldn't reach the server to buy this product"), {
        description: 'Your purchase was not completed.',
      });
      void product.refetch();
      void offers.refetch();
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const accept = useMutation({
    mutationFn: (offerId: number) => offersApi.acceptOffer(offerId),
    // Staying shows the accepted row, the frozen controls and the reserved banner in place.
    onSuccess: (reserved) => {
      setOpenForm(null);
      queryClient.setQueryData(['product', productId], reserved);
      void offers.refetch();
    },
    onError: (error) => {
      toast.error(refusal(error, "Couldn't reach the server to accept this offer"), {
        description: 'The offer was not accepted.',
      });
      void product.refetch();
      void offers.refetch();
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const counter = useMutation({
    mutationFn: (offer: CreateOfferRequest) => offersApi.createOffer(productId, offer),
    // Staying puts the new offer in the history the viewer is already reading.
    onSuccess: () => {
      setOpenForm(null);
      void product.refetch();
      void offers.refetch();
    },
    onError: (error) => {
      toast.error(refusal(error, "Couldn't reach the server to send this offer"), {
        description: 'Your offer was not sent.',
      });
      void product.refetch();
      void offers.refetch();
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

  if (product.isPending || offers.isPending) {
    return <p className="text-muted-foreground text-sm">Loading product…</p>;
  }

  if (product.isError || offers.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
          <CircleAlert className="size-4 shrink-0" />
          Couldn't load this product.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void product.refetch();
            void offers.refetch();
          }}
        >
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
          className={`flex flex-col gap-6 ${hasActions(product.data, offers.data) ? 'lg:col-span-2' : 'lg:col-span-3'}`}
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
          offers={offers.data}
          viewerId={session?.user.id}
          openForm={openForm}
          onOpenForm={setOpenForm}
          isWorking={purchase.isPending || accept.isPending || counter.isPending}
          onPurchase={() => {
            if (inFlight.current) return;

            inFlight.current = true;
            purchase.mutate();
          }}
          onAccept={(offerId) => {
            if (inFlight.current) return;

            inFlight.current = true;
            accept.mutate(offerId);
          }}
          onCounter={(amountCents, inReplyToOfferId) => {
            if (inFlight.current) return;

            inFlight.current = true;
            counter.mutate({ amountCents, inReplyToOfferId });
          }}
        />
      </div>

      {purchase.isSuccess && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <CircleCheck />
              </AlertDialogMedia>
              <AlertDialogTitle>Purchase successful</AlertDialogTitle>
              <AlertDialogDescription>
                {/* Non-null once sold: the sale is what sets it. */}
                You bought {purchase.data.name} for {formatPrice(purchase.data.finalPriceCents!)}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => navigate(ROUTES.products)}>
                Back to products
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
