import { useEffect, useState } from 'react';
import { healthResponseSchema, type HealthResponse } from '@linkby/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; health: HealthResponse }
  | { kind: 'error'; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((body) => setState({ kind: 'loaded', health: healthResponseSchema.parse(body) }))
      .catch((error: unknown) =>
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'unknown' }),
      );
  }, []);

  return (
    <main className="mx-auto max-w-md p-8 font-sans">
      <h1 className="text-2xl font-semibold">Linkby Marketplace</h1>
      <p className="mt-1 text-sm text-gray-500">Skeleton — LM-01</p>

      <div className="mt-6 rounded-lg border border-gray-200 p-4">
        {state.kind === 'loading' && <p className="text-gray-500">Checking API…</p>}

        {state.kind === 'error' && (
          <p className="text-red-600">Health check failed: {state.message}</p>
        )}

        {state.kind === 'loaded' && (
          <dl className="space-y-1 text-sm">
            <Row label="API" value={state.health.status} />
            <Row label="Database" value={state.health.database} />
            <Row label="Storage" value={state.health.storage} />
          </dl>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const good = value === 'ok' || value === 'up';
  return (
    <div className="flex justify-between">
      <dt className="text-gray-600">{label}</dt>
      <dd className={good ? 'text-green-600' : 'text-red-600'}>{value}</dd>
    </div>
  );
}
