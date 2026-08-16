import { Store } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES } from '@/lib/routes';

export function AppLayout() {
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to={ROUTES.products} className="font-medium">
            <span aria-hidden>🏷️</span> Linkby Marketplace
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to={ROUTES.newProduct}>
                <Store />
                Sell
              </Link>
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Logout
            </Button>
            {/* Which account is acting: roles are per-product, so the viewer has to be identifiable. */}
            <span className="text-muted-foreground text-sm">{session?.user.email}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
