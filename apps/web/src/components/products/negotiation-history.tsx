import type { OfferListItemResponse } from '@linkby/shared';
import { useState } from 'react';
import { CounterOfferForm } from '@/components/products/counter-offer-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatOfferTime, formatPrice } from '@/lib/format';

export type OpenForm = number | 'new' | null;

type Props = {
  offers: OfferListItemResponse[];
  seller: { id: number; displayName: string };
  viewerId: number | undefined;
  isWorking: boolean;
  openForm: OpenForm;
  onOpenForm: (open: OpenForm) => void;
  onAccept: (offerId: number) => void;
  onCounter: (amountCents: number, inReplyToOfferId: number) => void;
};

export function NegotiationHistory({
  offers,
  seller,
  viewerId,
  isWorking,
  openForm,
  onOpenForm,
  onAccept,
  onCounter,
}: Props) {
  const [threadFilter, setThreadFilter] = useState('all');

  const threads = [...new Map(offers.map((offer) => [offer.buyer.id, offer.buyer])).values()];
  // A buyer only ever wants their own thread singled out; naming the others would not help them.
  const filterable =
    seller.id === viewerId ? threads : threads.filter((buyer) => buyer.id === viewerId);
  const awaiting = offers.filter((offer) => offer.canRespond);
  const shown = offers.filter(
    (offer) => threadFilter === 'all' || String(offer.buyer.id) === threadFilter,
  );

  const [firstAwaiting] = awaiting;

  function reveal(offerId: number) {
    setThreadFilter('all');
    requestAnimationFrame(() =>
      document
        .getElementById(`offer-${offerId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Negotiation history</h2>

      {firstAwaiting !== undefined && (
        <button
          type="button"
          className="w-fit text-sm underline underline-offset-4"
          onClick={() => reveal(firstAwaiting.id)}
        >
          {awaiting.length} {awaiting.length === 1 ? 'offer' : 'offers'} awaiting your response
        </button>
      )}

      {threads.length > 1 && filterable.length > 0 && (
        <Select value={threadFilter} onValueChange={setThreadFilter}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All offers</SelectItem>
            {filterable.map((buyer) => (
              <SelectItem key={buyer.id} value={String(buyer.id)}>
                {buyer.id === viewerId ? 'You' : buyer.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <ol className="flex flex-col gap-3">
        {shown.map((offer) => {
          const bySeller = offer.madeBy === 'seller';
          // The viewer's own negotiation, both sides of it; every other buyer's thread stays neutral.
          const isMine = offer.buyer.id === viewerId;
          const buyerLabel = isMine ? 'You' : offer.buyer.displayName;
          const sellerLabel = seller.id === viewerId ? 'You' : seller.displayName;
          const author = bySeller ? sellerLabel : buyerLabel;

          return (
            <li
              key={offer.id}
              id={`offer-${offer.id}`}
              className={`flex flex-col gap-2 ${bySeller ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`w-[75%] rounded-lg border p-2 ${isMine ? 'border-l-primary bg-muted/60 border-l-4' : ''} ${offer.canRespond ? 'ring-foreground/25 ring-1' : ''}`}
              >
                <p className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {formatPrice(offer.amountCents)}
                  </span>
                  {offer.isAccepted && <Badge>Accepted</Badge>}
                </p>
                <p className="text-sm">
                  {buyerLabel} <span className="text-muted-foreground">(buyer)</span>{' '}
                  {bySeller ? '←' : '→'} {sellerLabel}{' '}
                  <span className="text-muted-foreground">(seller)</span>
                </p>
                <p className="text-muted-foreground text-xs">{formatOfferTime(offer.createdAt)}</p>
              </div>

              {offer.canRespond && openForm !== offer.id && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={isWorking} onClick={() => onAccept(offer.id)}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isWorking}
                    onClick={() => onOpenForm(offer.id)}
                  >
                    Counter Offer
                  </Button>
                </div>
              )}

              {openForm === offer.id && (
                <CounterOfferForm
                  id={`counter-${offer.id}`}
                  context={`Countering ${author}'s offer of ${formatPrice(offer.amountCents)}`}
                  submitLabel="Submit counter"
                  isWorking={isWorking}
                  onCancel={() => onOpenForm(null)}
                  onSubmit={(amountCents) => onCounter(amountCents, offer.id)}
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
