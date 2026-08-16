import { listProductsQuerySchema, PAGE_SIZE, PRODUCT_VIEWS } from '@linkby/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import * as productsApi from '@/api/products';
import { ProductCard } from '@/components/products/product-card';
import { ProductFilters } from '@/components/products/product-filters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDebounce } from '@/hooks/use-debounce';
import { ROUTES } from '@/lib/routes';

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULTS = listProductsQuerySchema.parse({});

export function ProductListPage() {
  const [params, setParams] = useSearchParams();

  // Read through the same schema the API validates with, so the two cannot drift.
  const parsed = listProductsQuerySchema.safeParse(Object.fromEntries(params));
  const { view, q, page } = parsed.success ? parsed.data : DEFAULTS;

  function updateParams(changes: Record<string, string>) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) =>
        value === '' ? next.delete(key) : next.set(key, value),
      );
      return next;
    });
  }

  // The box is local so typing stays responsive; the URL catches up once typing pauses.
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  const commitSearch = useDebounce((next: string) => {
    if (next !== q) updateParams({ q: next, page: '1' });
  }, SEARCH_DEBOUNCE_MS);

  const products = useQuery({
    queryKey: ['products', view, q, page],
    queryFn: () => productsApi.listProducts({ view, q, page }),
    // Holds the previous page on screen while the next loads, so paging does not flash.
    placeholderData: keepPreviousData,
    // Paging back to a page fetched seconds ago should not re-request it (§4.1).
    staleTime: 30_000,
  });

  // Separated from the JSX below so each state is an early return, as the rest of the app writes them.
  function renderGrid() {
    if (products.isPending) {
      return <p className="text-muted-foreground text-sm">Loading products…</p>;
    }

    if (products.isError) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
            <CircleAlert className="size-4 shrink-0" />
            Couldn't load products.
          </p>
          <Button variant="outline" onClick={() => void products.refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    const { items, total } = products.data;
    if (items.length === 0) {
      return (
        <EmptyState
          isFiltered={view !== PRODUCT_VIEWS.All || q !== ''}
          onClear={() => setParams({})}
        />
      );
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {totalPages > 1 && (
          <Pager
            page={page}
            totalPages={totalPages}
            onPage={(next) => updateParams({ page: String(next) })}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ProductFilters
        view={view}
        search={search}
        // `all` is this param's default, so it is elided rather than written to the URL.
        onViewChange={(next) =>
          updateParams({ view: next === PRODUCT_VIEWS.All ? '' : next, page: '1' })
        }
        onSearchChange={(next) => {
          setSearch(next);
          commitSearch(next);
        }}
      />

      {renderGrid()}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <p className="text-muted-foreground text-sm">
        Page {page} of {totalPages}
      </p>
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

function EmptyState({ isFiltered, onClear }: { isFiltered: boolean; onClear: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3">
        <p>{isFiltered ? 'No listings match this filter.' : 'No products listed yet.'}</p>
        {isFiltered ? (
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <Button asChild>
            <Link to={ROUTES.newProduct}>List the first product</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
