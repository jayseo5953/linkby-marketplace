import { useQuery } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { Link } from 'react-router';
import * as productsApi from '@/api/products';
import { ProductCard } from '@/components/products/product-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/lib/routes';

export function ProductListPage() {
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.listProducts });

  // Never "empty" before the fetch resolves (§2a).
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

  if (products.data.length === 0) {
    return (
      <Card className="mx-auto">
        <CardContent className="flex flex-col items-start gap-3">
          <p>No products listed yet.</p>
          <Button asChild>
            <Link to={ROUTES.newProduct}>List the first product</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.data.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
