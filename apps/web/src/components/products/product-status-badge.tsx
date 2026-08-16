import type { ProductListItemResponse } from '@linkby/shared';
import { Badge } from '@/components/ui/badge';

// Weight tracks how settled the state is: an outline for Available, solid for Sold.
const STATUS_BADGES: Record<
  ProductListItemResponse['status'],
  'default' | 'secondary' | 'outline'
> = {
  Available: 'outline',
  Reserved: 'secondary',
  Sold: 'default',
};

export function ProductStatusBadge({ status }: { status: ProductListItemResponse['status'] }) {
  return <Badge variant={STATUS_BADGES[status]}>{status}</Badge>;
}
