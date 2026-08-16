import type { ProductDetailResponse } from '@linkby/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';

type Props = {
  product: ProductDetailResponse;
  onPurchase: () => void;
  isWorking: boolean;
};

// Also asked by the page, which gives the panel's column back to the content when nothing would fill it.
export function hasActions(product: ProductDetailResponse): boolean {
  return product.viewer.canPurchase;
}

export function ProductActionPanel({ product, onPurchase, isWorking }: Props) {
  if (!hasActions(product)) return null;

  const { purchasePriceCents } = product.viewer;

  return (
    <aside className="lg:sticky lg:top-6">
      <Card>
        <CardContent className="flex flex-col gap-2">
          {product.viewer.canPurchase && purchasePriceCents !== null && (
            <Button onClick={onPurchase} disabled={isWorking}>
              {isWorking ? 'Working…' : `Purchase — ${formatPrice(purchasePriceCents)}`}
            </Button>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
