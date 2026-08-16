import { useState } from 'react';
import { PriceField } from '@/components/products/price-field';
import { Button } from '@/components/ui/button';
import { parsePriceToCents } from '@/lib/format';

type Props = {
  context: string;
  warning?: string;
  submitLabel: string;
  isWorking: boolean;
  onCancel: () => void;
  onSubmit: (amountCents: number) => void;
};

export function CounterOfferForm({
  context,
  warning,
  submitLabel,
  isWorking,
  onCancel,
  onSubmit,
}: Props) {
  const [price, setPrice] = useState('');

  const amountCents = parsePriceToCents(price);

  return (
    <form
      className="bg-muted/50 flex flex-col gap-3 rounded-lg border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (amountCents !== null) onSubmit(amountCents);
      }}
    >
      <p className="text-muted-foreground text-sm">{context}</p>

      <PriceField label="Your price" value={price} readOnly={isWorking} onChange={setPrice} />

      {warning !== undefined && <p className="text-muted-foreground text-sm">{warning}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isWorking}>
          Cancel
        </Button>
        <Button type="submit" disabled={amountCents === null || isWorking}>
          {isWorking ? 'Working…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
