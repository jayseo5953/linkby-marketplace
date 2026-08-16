export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatOfferTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const DOLLARS = /^\d+(\.\d{1,2})?$/;

// The browser owns the dollars-to-cents conversion; the API only ever parses cents.
export function parsePriceToCents(dollars: string): number | null {
  const trimmed = dollars.trim();
  if (!DOLLARS.test(trimmed)) return null;

  const cents = Math.round(Number(trimmed) * 100);
  return cents > 0 ? cents : null;
}
