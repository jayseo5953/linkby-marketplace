import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const DATABASE_URL = process.env.SMOKE_DATABASE_URL ?? 'postgres://linkby:linkby@localhost:5432/linkby';
const PASSWORD = 'password123';

type Session = { token: string; user: { id: number; displayName: string } };
type HistoryRow = {
  id: number;
  buyer: { id: number };
  amountCents: number;
  isLatestInThread: boolean;
  canRespond: boolean;
};

// Keyed by name rather than an index signature, so each session reads as present.
const session = {} as Record<'alice' | 'bob' | 'carol', Session>;
// Every product this run creates, so the cleanup can name exactly what it removes.
const created: number[] = [];

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; form?: FormData } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });

  return { status: response.status, body: await response.json().catch(() => null) };
}

async function login(email: string): Promise<Session> {
  const { status, body } = await call('POST', '/api/auth/login', {
    body: { email, password: PASSWORD },
  });
  expect(status, `login ${email}`).toBe(200);

  return body;
}

// A product per scenario, so the suite never mutates a seeded row and re-runs without a reseed.
async function listProduct(name: string, priceCents: number, withImage = false): Promise<number> {
  const form = new FormData();
  form.set('name', `Smoke ${name} ${Date.now()}`);
  form.set('description', 'Created by the smoke suite.');
  form.set('priceCents', String(priceCents));
  if (withImage) {
    form.set('images', new Blob([PNG_PIXEL], { type: 'image/png' }), 'pixel.png');
  }

  const { status, body } = await call('POST', '/api/products', { token: session.alice.token, form });
  expect(status, `create ${name}`).toBe(201);
  created.push(body.id);

  return body.id;
}

const offer = (token: string, productId: number, amountCents: number, inReplyToOfferId?: number) =>
  call('POST', `/api/products/${productId}/offers`, {
    token,
    body: { amountCents, ...(inReplyToOfferId ? { inReplyToOfferId } : {}) },
  });

const PNG_PIXEL = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
);

beforeAll(async () => {
  const health = await call('GET', '/health');
  expect(health.status, `no API at ${API} — run \`docker compose up -d\` first`).toBe(200);

  session.alice = await login('alice@example.com');
  session.bob = await login('bob@example.com');
  session.carol = await login('carol@example.com');
});

// Removes this run's rows by id, so a seeded row can never be caught by it. Offers go with them
// through the products foreign key's `on delete cascade`.
afterAll(async () => {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    if (created.length > 0) {
      await pool.query('delete from products where id = any($1::bigint[])', [created]);
    }
  } finally {
    await pool.end();
  }
});

describe('session', () => {
  it('rejects a request with no token', async () => {
    expect((await call('GET', '/api/me')).status).toBe(401);
  });

  it('rejects a token that is not a JWT', async () => {
    const { status, body } = await call('GET', '/api/me', { token: 'not.a.jwt' });
    expect(status).toBe(401);
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects a wrong password without saying which half was wrong', async () => {
    const { status, body } = await call('POST', '/api/auth/login', {
      body: { email: 'alice@example.com', password: 'wrong' },
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the signed-in user and never the password hash', async () => {
    const { status, body } = await call('GET', '/api/me', { token: session.alice.token });
    expect(status).toBe(200);
    expect(body.displayName).toBe('Alice');
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('returns the error envelope for an unrouted path', async () => {
    const { status, body } = await call('GET', '/api/nope');
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('listing a product', () => {
  it('creates with an image, then appears in the list and the detail', async () => {
    const id = await listProduct('Listing', 5000, true);

    const list = await call('GET', '/api/products', { token: session.bob.token });
    expect(list.status).toBe(200);
    // Newest first, so a product created a moment ago is on the first page.
    expect(list.body.items.some((row: { id: number }) => row.id === id)).toBe(true);

    const detail = await call('GET', `/api/products/${id}`, { token: session.bob.token });
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe('Available');
    expect(detail.body.imageUrls).toHaveLength(1);
    expect(detail.body.viewer).toEqual({
      canPurchase: true,
      purchasePriceCents: 5000,
      canStartNegotiation: true,
    });
  });

  it('refuses SVG, which can carry script', async () => {
    const form = new FormData();
    form.set('name', 'Smoke SVG');
    form.set('description', 'x');
    form.set('priceCents', '100');
    form.set('images', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }), 'a.svg');

    const { status, body } = await call('POST', '/api/products', { token: session.alice.token, form });
    expect(status).toBe(400);
    expect(body.error.code).toBe('UNSUPPORTED_IMAGE_TYPE');
  });

  it('rejects a price that is not a whole number of cents', async () => {
    const form = new FormData();
    form.set('name', 'Smoke Bad Price');
    form.set('description', 'x');
    form.set('priceCents', '12.5');

    const { status, body } = await call('POST', '/api/products', { token: session.alice.token, form });
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses the seller their own product', async () => {
    const id = await listProduct('Own', 1000);

    const detail = await call('GET', `/api/products/${id}`, { token: session.alice.token });
    expect(detail.body.viewer.canPurchase).toBe(false);

    const purchase = await call('POST', `/api/products/${id}/purchase`, {
      token: session.alice.token,
    });
    expect(purchase.status).toBe(409);
    expect(purchase.body.error.code).toBe('OWN_PRODUCT');
  });
});

describe('negotiation', () => {
  it('runs a full thread and reflects each viewer in the history', async () => {
    const id = await listProduct('Thread', 10000);

    const opened = await offer(session.bob.token, id, 8000);
    expect(opened.status).toBe(201);
    expect(opened.body.madeBy).toBe('buyer');
    expect(opened.body.buyerId).toBe(session.bob.user.id);

    const countered = await offer(session.alice.token, id, 9000, opened.body.id);
    expect(countered.status).toBe(201);
    expect(countered.body.madeBy).toBe('seller');
    // The seller's counter carries the buyer's id: it names the thread, not the author.
    expect(countered.body.buyerId).toBe(session.bob.user.id);

    const fromCarol = await offer(session.carol.token, id, 7000);
    expect(fromCarol.status).toBe(201);

    const history = await call('GET', `/api/products/${id}/offers`, { token: session.alice.token });
    expect(history.status).toBe(200);
    expect(history.body.map((row: HistoryRow) => row.amountCents)).toEqual([
      8000, 9000, 7000,
    ]);
    // Every viewer sees every thread.
    expect(new Set(history.body.map((row: HistoryRow) => row.buyer.id)).size).toBe(2);

    const forAlice = Object.fromEntries(history.body.map((row: HistoryRow) => [row.id, row]));
    expect(forAlice[opened.body.id].isLatestInThread).toBe(false);
    expect(forAlice[countered.body.id].isLatestInThread).toBe(true);
    // Alice answers Carol's live offer, but not her own counter.
    expect(forAlice[fromCarol.body.id].canRespond).toBe(true);
    expect(forAlice[countered.body.id].canRespond).toBe(false);

    const asBob = await call('GET', `/api/products/${id}/offers`, { token: session.bob.token });
    const forBob = Object.fromEntries(asBob.body.map((row: HistoryRow) => [row.id, row]));
    // Bob answers the seller inside his own thread, and nothing in Carol's.
    expect(forBob[countered.body.id].canRespond).toBe(true);
    expect(forBob[fromCarol.body.id].canRespond).toBe(false);
  });

  it('names the rule that stopped each refused offer', async () => {
    const id = await listProduct('Refusals', 10000);
    const opened = await offer(session.bob.token, id, 8000);

    expect((await offer(session.alice.token, id, 5000)).body.error.code).toBe('OWN_PRODUCT');
    expect((await offer(session.bob.token, id, 8500)).body.error.code).toBe('THREAD_ALREADY_OPEN');
    expect((await offer(session.carol.token, id, 6000, opened.body.id)).body.error.code).toBe(
      'NOT_YOUR_TURN',
    );

    expect((await offer(session.alice.token, id, 9000, opened.body.id)).status).toBe(201);
    // The offer Alice answered is no longer the newest in Bob's thread.
    expect((await offer(session.bob.token, id, 8200, opened.body.id)).body.error.code).toBe(
      'OFFER_SUPERSEDED',
    );

    const purchase = await call('POST', `/api/products/${id}/purchase`, { token: session.bob.token });
    expect(purchase.body.error.code).toBe('NEGOTIATION_OPEN');
  });
});

describe('settling', () => {
  it('accept reserves at the offered amount, then the reserved buyer buys it', async () => {
    const id = await listProduct('Accept', 10000);
    const opened = await offer(session.bob.token, id, 7500);

    const accepted = await call('POST', `/api/offers/${opened.body.id}/accept`, {
      token: session.alice.token,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('Reserved');
    expect(accepted.body.buyerId).toBe(session.bob.user.id);
    expect(accepted.body.finalPriceCents).toBe(7500);
    // The listed price survives the settlement.
    expect(accepted.body.priceCents).toBe(10000);

    const forCarol = await call('GET', `/api/products/${id}`, { token: session.carol.token });
    expect(forCarol.body.viewer.canPurchase).toBe(false);

    const forBob = await call('GET', `/api/products/${id}`, { token: session.bob.token });
    expect(forBob.body.viewer).toEqual({
      canPurchase: true,
      purchasePriceCents: 7500,
      canStartNegotiation: false,
    });

    const bought = await call('POST', `/api/products/${id}/purchase`, { token: session.bob.token });
    expect(bought.status).toBe(200);
    expect(bought.body.status).toBe('Sold');
    expect(bought.body.finalPriceCents).toBe(7500);

    // A settled product freezes every row control.
    const history = await call('GET', `/api/products/${id}/offers`, { token: session.alice.token });
    expect(history.body.every((row: HistoryRow) => row.canRespond === false)).toBe(true);
  });

  it('a direct purchase settles at the listed price', async () => {
    const id = await listProduct('Direct', 4200);

    const bought = await call('POST', `/api/products/${id}/purchase`, { token: session.bob.token });
    expect(bought.status).toBe(200);
    expect(bought.body.status).toBe('Sold');
    expect(bought.body.finalPriceCents).toBe(4200);

    const again = await call('POST', `/api/products/${id}/purchase`, { token: session.carol.token });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('PRODUCT_NOT_AVAILABLE');
  });
});

describe('atomicity', () => {
  it('ten simultaneous purchases sell the product exactly once', async () => {
    const id = await listProduct('Race', 3000);

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        call('POST', `/api/products/${id}/purchase`, { token: session.bob.token }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.status === 200)).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 409)).toHaveLength(9);

    const detail = await call('GET', `/api/products/${id}`, { token: session.bob.token });
    expect(detail.body.status).toBe('Sold');
  });

  it('simultaneous accepts on two threads reserve for exactly one buyer', async () => {
    const id = await listProduct('Accept Race', 6000);
    const fromBob = await offer(session.bob.token, id, 5000);
    const fromCarol = await offer(session.carol.token, id, 5500);

    const attempts = await Promise.all([
      call('POST', `/api/offers/${fromBob.body.id}/accept`, { token: session.alice.token }),
      call('POST', `/api/offers/${fromCarol.body.id}/accept`, { token: session.alice.token }),
    ]);

    // Which one wins is scheduling; that exactly one wins is the guarantee.
    expect(attempts.filter((attempt) => attempt.status === 200)).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 409)).toHaveLength(1);

    const detail = await call('GET', `/api/products/${id}`, { token: session.alice.token });
    expect(detail.body.status).toBe('Reserved');
    expect([session.bob.user.id, session.carol.user.id]).toContain(detail.body.buyerId);
  });

  it('a purchase racing an accept leaves one of the two legal states, never a mixture', async () => {
    const id = await listProduct('Cross Race', 4000);
    // Bob negotiates, so Carol is the only one who can still buy it outright.
    const fromBob = await offer(session.bob.token, id, 3500);

    const [purchase, accept] = await Promise.all([
      call('POST', `/api/products/${id}/purchase`, { token: session.carol.token }),
      call('POST', `/api/offers/${fromBob.body.id}/accept`, { token: session.alice.token }),
    ]);

    expect([purchase.status, accept.status].filter((status) => status === 200)).toHaveLength(1);

    const detail = await call('GET', `/api/products/${id}`, { token: session.alice.token });
    // Sold to Carol at the listed price, or reserved for Bob at his — and the winner says which.
    expect(detail.body).toMatchObject(
      purchase.status === 200
        ? { status: 'Sold', buyerId: session.carol.user.id, finalPriceCents: 4000 }
        : { status: 'Reserved', buyerId: session.bob.user.id, finalPriceCents: 3500 },
    );
  });
});

// Two writes contending for one product row; each case asserts the loser is refused, not merged.
describe('concurrency locking', () => {
  it('two simultaneous opening offers leave one offer on the thread', async () => {
    const id = await listProduct('Offer Race', 5000);

    const attempts = await Promise.all([
      offer(session.bob.token, id, 4000),
      offer(session.bob.token, id, 4200),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 201)).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 409)).toHaveLength(1);
    expect(attempts.map((attempt) => attempt.body.error?.code).filter(Boolean)).toEqual([
      'THREAD_ALREADY_OPEN',
    ]);

    const history = await call('GET', `/api/products/${id}/offers`, { token: session.bob.token });
    expect(history.body).toHaveLength(1);
  });

  it('two simultaneous counters answer the same offer only once', async () => {
    const id = await listProduct('Counter Race', 5000);
    const opened = await offer(session.bob.token, id, 4000);

    const attempts = await Promise.all([
      offer(session.alice.token, id, 4500, opened.body.id),
      offer(session.alice.token, id, 4700, opened.body.id),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 201)).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 409)).toHaveLength(1);
    expect(attempts.map((attempt) => attempt.body.error?.code).filter(Boolean)).toEqual([
      'OFFER_SUPERSEDED',
    ]);

    const history = await call('GET', `/api/products/${id}/offers`, { token: session.bob.token });
    expect(history.body).toHaveLength(2);
    expect(history.body.filter((row: HistoryRow) => row.isLatestInThread)).toHaveLength(1);
  });

  it('two buyers purchasing at once sell to exactly one of them', async () => {
    const id = await listProduct('Two Buyers', 3000);

    const attempts = await Promise.all([
      call('POST', `/api/products/${id}/purchase`, { token: session.bob.token }),
      call('POST', `/api/products/${id}/purchase`, { token: session.carol.token }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 200)).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 409)).toHaveLength(1);

    const detail = await call('GET', `/api/products/${id}`, { token: session.alice.token });
    expect(detail.body.status).toBe('Sold');
    expect([session.bob.user.id, session.carol.user.id]).toContain(detail.body.buyerId);
  });

  it('two simultaneous accepts of the same offer reserve it once', async () => {
    const id = await listProduct('Double Accept', 6000);
    const opened = await offer(session.bob.token, id, 5000);

    const attempts = await Promise.all([
      call('POST', `/api/offers/${opened.body.id}/accept`, { token: session.alice.token }),
      call('POST', `/api/offers/${opened.body.id}/accept`, { token: session.alice.token }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 200)).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 409)).toHaveLength(1);

    const detail = await call('GET', `/api/products/${id}`, { token: session.alice.token });
    expect(detail.body).toMatchObject({
      status: 'Reserved',
      buyerId: session.bob.user.id,
      finalPriceCents: 5000,
    });
  });

  it('accepting and countering the same offer at once settles it one way', async () => {
    const id = await listProduct('Answer Race', 8000);
    const opened = await offer(session.bob.token, id, 6000);
    const countered = await offer(session.alice.token, id, 7000, opened.body.id);

    // Both are legal answers by Bob to the same offer, so the lock has to pick one.
    const [accept, counter] = await Promise.all([
      call('POST', `/api/offers/${countered.body.id}/accept`, { token: session.bob.token }),
      offer(session.bob.token, id, 6500, countered.body.id),
    ]);

    expect([accept.status === 200, counter.status === 201].filter(Boolean)).toHaveLength(1);

    const detail = await call('GET', `/api/products/${id}`, { token: session.alice.token });
    expect(detail.body.status).toBe(accept.status === 200 ? 'Reserved' : 'Available');
  });

  it('a reserved product stays with its buyer when an outsider buys at the same moment', async () => {
    const id = await listProduct('Reserved Gate', 7000);
    const opened = await offer(session.bob.token, id, 6000);
    await call('POST', `/api/offers/${opened.body.id}/accept`, { token: session.alice.token });

    const [reserved, outsider] = await Promise.all([
      call('POST', `/api/products/${id}/purchase`, { token: session.bob.token }),
      call('POST', `/api/products/${id}/purchase`, { token: session.carol.token }),
    ]);

    expect(reserved.status).toBe(200);
    expect(outsider.status).toBe(409);

    const detail = await call('GET', `/api/products/${id}`, { token: session.alice.token });
    expect(detail.body).toMatchObject({
      status: 'Sold',
      buyerId: session.bob.user.id,
      finalPriceCents: 6000,
    });
  });
});
