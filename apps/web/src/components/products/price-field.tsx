import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parsePriceToCents } from '@/lib/format';

type Props = {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
};

export function PriceField({ label, value, readOnly, onChange }: Props) {
  const id = useId();
  // An empty field explains itself; something typed that cannot be a price does not.
  const isUnusable = value.trim() !== '' && parsePriceToCents(value) === null;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">$</span>
        <Input
          id={id}
          inputMode="decimal"
          placeholder="250.00"
          value={value}
          readOnly={readOnly}
          aria-invalid={isUnusable}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {isUnusable && (
        <p role="alert" className="text-destructive text-sm">
          Enter an amount greater than 0, in dollars and cents — for example 250.00.
        </p>
      )}
    </div>
  );
}
