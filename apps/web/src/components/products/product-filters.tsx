import { PRODUCT_VIEWS, type ProductView } from '@linkby/shared';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_VIEWS: { value: ProductView; label: string }[] = [
  { value: PRODUCT_VIEWS.All, label: 'All listings' },
  { value: PRODUCT_VIEWS.Available, label: 'Available' },
  { value: PRODUCT_VIEWS.Reserved, label: 'Reserved' },
  { value: PRODUCT_VIEWS.Sold, label: 'Sold' },
];

const MINE_VIEWS: { value: ProductView; label: string }[] = [
  { value: PRODUCT_VIEWS.ListedByMe, label: 'Listed by me' },
  { value: PRODUCT_VIEWS.ReservedForMe, label: 'Reserved for me' },
];

type Props = {
  view: ProductView;
  search: string;
  onViewChange: (view: ProductView) => void;
  onSearchChange: (search: string) => void;
};

export function ProductFilters({ view, search, onViewChange, onSearchChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={view} onValueChange={(next: string) => onViewChange(next as ProductView)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_VIEWS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
          <SelectSeparator />
          {MINE_VIEWS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative min-w-56 flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder="Search listings"
          aria-label="Search listings"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  );
}
