import type { OfferListItemResponse, ProductDetailResponse } from '@linkby/shared';
import { CounterOfferForm } from '@/components/products/counter-offer-form';
import { NegotiationHistory, type OpenForm } from '@/components/products/negotiation-history';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';

type Props = {
  product: ProductDetailResponse;
  offers: OfferListItemResponse[];
  viewerId: number | undefined;
  isWorking: boolean;
  openForm: OpenForm;
  onOpenForm: (open: OpenForm) => void;
  onPurchase: () => void;
  onAccept: (offerId: number) => void;
  onCounter: (amountCents: number, inReplyToOfferId?: number) => void;
};

// Also asked by the page, which gives the panel's column back to the content when nothing would fill it.
export function hasActions(product: ProductDetailResponse, offers: OfferListItemResponse[]): boolean {
  return product.viewer.canPurchase || product.viewer.canStartNegotiation || offers.length > 0;
}

export function ProductActionPanel({
  product,
  offers,
  viewerId,
  isWorking,
  openForm,
  onOpenForm,
  onPurchase,
  onAccept,
  onCounter,
}: Props) {
  if (!hasActions(product, offers)) return null;

  const { canPurchase, canStartNegotiation, purchasePriceCents } = product.viewer;

  return (
    <aside className="lg:sticky lg:top-6">
      <Card>
        <CardContent className="flex flex-col gap-4">
          {canPurchase && purchasePriceCents !== null && (
            <Button onClick={onPurchase} disabled={isWorking}>
              {isWorking ? 'Working…' : `Purchase — ${formatPrice(purchasePriceCents)}`}
            </Button>
          )}

          {canStartNegotiation && openForm !== 'new' && (
            <Button variant="outline" disabled={isWorking} onClick={() => onOpenForm('new')}>
              Counter Offer
            </Button>
          )}

          {canStartNegotiation && openForm === 'new' && (
            <CounterOfferForm
              id="counter-new"
              context={`Listed price: ${formatPrice(product.priceCents)}`}
              warning="Submitting starts a negotiation. You will no longer be able to buy this product at the listed price."
              submitLabel="Submit offer"
              isWorking={isWorking}
              onCancel={() => onOpenForm(null)}
              onSubmit={(amountCents) => onCounter(amountCents)}
            />
          )}

          {offers.length > 0 && (
            <NegotiationHistory
              offers={offers}
              seller={product.seller}
              viewerId={viewerId}
              isWorking={isWorking}
              openForm={openForm}
              onOpenForm={onOpenForm}
              onAccept={onAccept}
              onCounter={onCounter}
            />
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
