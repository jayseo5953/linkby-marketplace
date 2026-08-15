import type { OfferSide, SessionUser } from '@linkby/shared';
import { describe, expect, it } from 'vitest';
import { type OfferEntity, type ProductEntity, ProductPolicy } from './product-policy';

const alice: SessionUser = { id: 1, email: 'alice@example.com', displayName: 'Alice' };
const bob: SessionUser = { id: 2, email: 'bob@example.com', displayName: 'Bob' };
const carol: SessionUser = { id: 3, email: 'carol@example.com', displayName: 'Carol' };

const PRODUCT: ProductEntity = {
  id: 1,
  sellerId: alice.id,
  status: 'Available',
  buyerId: null,
  priceCents: 25000,
  finalPriceCents: null,
  name: 'Vintage Camera',
  description: 'A camera.',
  imageKeys: [],
  createdAt: new Date('2026-08-15T00:00:00Z'),
};

// Ids only need to rise within a thread, but one counter keeps them unique across threads too.
let nextOfferId = 0;

/** A thread's offers in the order they were made, e.g. `thread(bob.id, 'buyer', 'seller')`. */
function thread(buyerId: number, ...sides: OfferSide[]): OfferEntity[] {
  return sides.map((madeBy) => ({
    id: ++nextOfferId,
    productId: PRODUCT.id,
    buyerId,
    madeBy,
    amountCents: 20000,
    createdAt: new Date('2026-08-15T00:00:00Z'),
  }));
}

// Alice sells everything here, so `viewer: alice` is the seller case in every test below.
function policyFor(
  viewer: SessionUser,
  product: Partial<ProductEntity> = {},
  offers: OfferEntity[] = [],
) {
  return new ProductPolicy({ viewer, product: { ...PRODUCT, ...product }, offers });
}

// Rows are numbered as in wireframes.md §4.4, so a change to that table has an obvious counterpart.
describe('canPurchase — §4.4 truth table', () => {
  it('1. hides from the seller on an Available product', () => {
    expect(policyFor(alice).canPurchase).toBe(false);
  });

  it('2. hides from the seller on a Reserved product', () => {
    expect(policyFor(alice, { status: 'Reserved', buyerId: bob.id }).canPurchase).toBe(false);
  });

  it('3. hides from the seller on a Sold product', () => {
    expect(policyFor(alice, { status: 'Sold', buyerId: bob.id }).canPurchase).toBe(false);
  });

  it('4. offers it to a buyer with no negotiation', () => {
    expect(policyFor(bob).canPurchase).toBe(true);
  });

  it('5. hides it from a buyer who has opened a negotiation', () => {
    expect(policyFor(bob, {}, thread(bob.id, 'buyer')).canPurchase).toBe(false);
  });

  it('6. offers it to the reserved buyer, despite their negotiation', () => {
    const offers = thread(bob.id, 'buyer', 'seller', 'buyer');
    expect(policyFor(bob, { status: 'Reserved', buyerId: bob.id }, offers).canPurchase).toBe(true);
  });

  it('7. hides it from a buyer whose own thread lost the reservation', () => {
    const offers = [...thread(bob.id, 'buyer'), ...thread(carol.id, 'buyer')];
    expect(policyFor(carol, { status: 'Reserved', buyerId: bob.id }, offers).canPurchase).toBe(
      false,
    );
  });

  it('8. hides it from an uninvolved buyer while reserved', () => {
    const offers = thread(bob.id, 'buyer');
    expect(policyFor(carol, { status: 'Reserved', buyerId: bob.id }, offers).canPurchase).toBe(
      false,
    );
  });

  it('9. hides it from everyone once sold, including the buyer who bought it', () => {
    const sold = { status: 'Sold' as const, buyerId: bob.id };
    expect(policyFor(bob, sold).canPurchase).toBe(false);
    expect(policyFor(carol, sold).canPurchase).toBe(false);
  });
});

describe('purchasePriceCents', () => {
  it('charges the listed price on a direct purchase', () => {
    expect(policyFor(bob, { priceCents: 25000 }).purchasePriceCents).toBe(25000);
  });

  it('charges the accepted price, not the listing, when reserved', () => {
    const policy = policyFor(
      bob,
      { status: 'Reserved', buyerId: bob.id, priceCents: 25000, finalPriceCents: 22000 },
      thread(bob.id, 'buyer', 'seller'),
    );

    expect(policy.purchasePriceCents).toBe(22000);
  });

  it('is null whenever the purchase is refused, so no price can be shown', () => {
    const policy = policyFor(alice);
    expect(policy.canPurchase).toBe(false);
    expect(policy.purchasePriceCents).toBeNull();
  });
});

describe('canStartNegotiation', () => {
  it('offers the opening button to a buyer with no thread', () => {
    expect(policyFor(bob).canStartNegotiation).toBe(true);
  });

  it('withdraws it once that buyer has a thread', () => {
    expect(policyFor(bob, {}, thread(bob.id, 'buyer')).canStartNegotiation).toBe(false);
  });

  it('never shows it to the seller, who cannot open a thread on their own product', () => {
    expect(policyFor(alice).canStartNegotiation).toBe(false);
  });

  it('withdraws it once the product leaves Available', () => {
    expect(policyFor(bob, { status: 'Reserved', buyerId: carol.id }).canStartNegotiation).toBe(
      false,
    );
  });

  it("is unaffected by another buyer's thread", () => {
    expect(policyFor(carol, {}, thread(bob.id, 'buyer')).canStartNegotiation).toBe(true);
  });
});

describe('canCounter — turns alternate within a thread', () => {
  it('lets the seller answer a buyer, and not the buyer who just spoke', () => {
    const offers = thread(bob.id, 'buyer');
    const opening = offers[0]!;

    expect(policyFor(alice, {}, offers).canCounter(opening)).toBe(true);
    expect(policyFor(bob, {}, offers).canCounter(opening)).toBe(false);
  });

  it("lets the buyer answer the seller's counter, and not the seller again", () => {
    const offers = thread(bob.id, 'buyer', 'seller');
    const counter = offers[1]!;

    expect(policyFor(bob, {}, offers).canCounter(counter)).toBe(true);
    expect(policyFor(alice, {}, offers).canCounter(counter)).toBe(false);
  });

  it('lets nobody act once the product has left Available', () => {
    const offers = thread(bob.id, 'buyer');
    const reserved = { status: 'Reserved' as const, buyerId: bob.id };

    expect(policyFor(alice, reserved, offers).canCounter(offers[0]!)).toBe(false);
    expect(policyFor(bob, reserved, offers).canCounter(offers[0]!)).toBe(false);
  });
});

describe('canCounter — only the newest offer in a thread is actionable', () => {
  it('refuses the seller an earlier buyer offer they could once have answered', () => {
    const offers = thread(bob.id, 'buyer', 'seller', 'buyer');
    const policy = policyFor(alice, {}, offers);

    // Both were made by the buyer, so read on their own they are indistinguishable to the seller.
    expect(policy.canCounter(offers[0]!)).toBe(false);
    expect(policy.canCounter(offers[2]!)).toBe(true);
  });
});

describe('canCounter — threads are isolated from each other', () => {
  const offers = [
    ...thread(bob.id, 'buyer', 'seller'), // Bob's turn
    ...thread(carol.id, 'buyer'), // Alice's turn
  ];
  const bobsNewest = offers[1]!;
  const carolsNewest = offers[2]!;

  it('lets the seller hold unanswered counters in any number of threads at once', () => {
    const policy = policyFor(alice, {}, offers);

    // Alice already countered Bob and it is his turn, which must not stop her answering Carol.
    expect(policy.canCounter(bobsNewest)).toBe(false);
    expect(policy.canCounter(carolsNewest)).toBe(true);
  });

  it("refuses a buyer any offer in another buyer's thread", () => {
    expect(policyFor(carol, {}, offers).canCounter(bobsNewest)).toBe(false);
  });

  it('leaves whose turn it is in one thread untouched when another buyer acts', () => {
    expect(policyFor(bob, {}, offers).canCounter(bobsNewest)).toBe(true);
  });
});

describe('newestInThread', () => {
  it('is undefined for a buyer with no thread, which is how an opening offer is recognised', () => {
    expect(policyFor(alice, {}, thread(bob.id, 'buyer')).newestInThread(carol.id)).toBeUndefined();
  });

  it('follows the thread as it grows', () => {
    const offers = thread(bob.id, 'buyer', 'seller', 'buyer');
    expect(policyFor(alice, {}, offers).newestInThread(bob.id)).toBe(offers[2]);
  });
});

describe('toViewer', () => {
  it('states the wire shape rather than exposing the instance', () => {
    expect(policyFor(bob, { priceCents: 4500 }).toViewer()).toEqual({
      canPurchase: true,
      purchasePriceCents: 4500,
      canStartNegotiation: true,
    });
  });
});
