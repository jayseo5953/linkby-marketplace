import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col items-start justify-center gap-3 px-4">
      <h1 className="text-xl font-medium">Page not found</h1>
      <Button asChild variant="outline">
        <Link to={ROUTES.products}>Back to products</Link>
      </Button>
    </main>
  );
}
