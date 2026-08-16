import { useMutation } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import * as authApi from '@/api/auth';
import { errorMessage } from '@/lib/http';
import { ROUTES } from '@/lib/routes';

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (result) => {
      signIn(result);
      navigate(ROUTES.products, { replace: true });
    },
    // Only the password: a rejected one left in place invites an identical resubmit.
    onError: () => setPassword(''),
  });

  if (session !== null) return <Navigate to={ROUTES.products} replace />;

  const canSubmit = email !== '' && password !== '' && !login.isPending;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-center text-2xl font-medium">
        <span aria-hidden>🏷️</span> Linkby Marketplace
      </h1>

      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate();
            }}
          >
            {login.error !== null && (
              <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
                <CircleAlert className="size-4 shrink-0" />
                {errorMessage(login.error, 'Something went wrong. Please try again.')}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                // Free text (§1): `type="email"` lets the browser reject it before the server sees it.
                type="text"
                autoComplete="email"
                value={email}
                readOnly={login.isPending}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                readOnly={login.isPending}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <Button type="submit" className="self-end" disabled={!canSubmit}>
              {login.isPending ? 'Logging in…' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-sm">
        Seeded test accounts only — there is no registration.
      </p>
    </main>
  );
}
