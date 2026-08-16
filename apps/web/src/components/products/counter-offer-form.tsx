import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parsePriceToCents } from '@/lib/format';

type Props = {
  id: string;
  context: string;
  warning?: string;
  submitLabel: string;
  isWorking: boolean;
  onCancel: () => void;
  onSubmit: (amountCents: number) => void;
};

export function CounterOfferForm({
  id,
  context,
  warning,
  submitLabel,
  isWorking,
  onCancel,
  onSubmit,
}: Props) {
  const [price, setPrice] = useState('');

  const amountCents = parsePriceToCents(price);
  // An empty field explains itself; something typed that cannot be a price does not.
  const priceIsUnusable = price.trim() !== '' && amountCents === null;

  return (
    <form
      className="bg-muted/50 flex flex-col gap-3 rounded-lg border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (amountCents !== null && !isWorking) onSubmit(amountCents);
      }}
    >
      <p className="text-muted-foreground text-sm">{context}</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Your price</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            id={id}
            autoFocus
            inputMode="decimal"
            placeholder="220.00"
            value={price}
            readOnly={isWorking}
            aria-invalid={priceIsUnusable}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        {priceIsUnusable && (
          <p role="alert" className="text-destructive text-sm">
            Enter an amount greater than 0, in dollars and cents — for example 220.00.
          </p>
        )}
      </div>

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
