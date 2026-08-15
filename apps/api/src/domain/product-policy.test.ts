import type { OfferSide, SessionUser } from '@linkby/shared';
import { describe, expect, it } from 'vitest';
import {
  NegotiationRefusal,
  type OfferEntity,
  type ProductEntity,
  ProductPolicy,
  PurchaseRefusal,
  RespondRefusal,
} from './product-policy';

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

describe('refusalToPurchase', () => {
  it('tells the seller it is their own product, whatever else is true', () => {
    const sold = { status: 'Sold' as const, buyerId: bob.id };
    expect(policyFor(alice).refusalToPurchase()).toBe(PurchaseRefusal.OwnProduct);
    expect(policyFor(alice, sold).refusalToPurchase()).toBe(PurchaseRefusal.OwnProduct);
  });

  it('separates a gone product from the buyer’s own open negotiation', () => {
    const sold = { status: 'Sold' as const, buyerId: carol.id };
    expect(policyFor(bob, sold).refusalToPurchase()).toBe(PurchaseRefusal.NotAvailable);
    expect(policyFor(bob, {}, thread(bob.id, 'buyer')).refusalToPurchase()).toBe(
      PurchaseRefusal.NegotiationOpen,
    );
  });

  it('reports the gone product first, since the open thread is then moot', () => {
    const offers = thread(bob.id, 'buyer');
    const reserved = { status: 'Reserved' as const, buyerId: carol.id };
    expect(policyFor(bob, reserved, offers).refusalToPurchase()).toBe(PurchaseRefusal.NotAvailable);
  });

  it('is null for the reserved buyer, who is exempt from both', () => {
    const offers = thread(bob.id, 'buyer', 'seller');
    const reserved = { status: 'Reserved' as const, buyerId: bob.id, finalPriceCents: 20000 };
    expect(policyFor(bob, reserved, offers).refusalToPurchase()).toBeNull();
  });
});

describe('refusalToStartNegotiation', () => {
  it('names each rule that can stop a thread being opened', () => {
    expect(policyFor(alice).refusalToStartNegotiation()).toBe(NegotiationRefusal.OwnProduct);
    expect(
      policyFor(bob, { status: 'Sold', buyerId: carol.id }).refusalToStartNegotiation(),
    ).toBe(NegotiationRefusal.NotAvailable);
    expect(policyFor(bob, {}, thread(bob.id, 'buyer')).refusalToStartNegotiation()).toBe(
      NegotiationRefusal.ThreadOpen,
    );
  });

  it('is null when the thread may be opened', () => {
    expect(policyFor(bob).refusalToStartNegotiation()).toBeNull();
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

describe('refusalToRespond — turns alternate within a thread', () => {
  it('lets the seller answer a buyer, and not the buyer who just spoke', () => {
    const offers = thread(bob.id, 'buyer');
    const opening = offers[0]!;

    expect(policyFor(alice, {}, offers).refusalToRespond(opening)).toBeNull();
    expect(policyFor(bob, {}, offers).refusalToRespond(opening)).toBe(RespondRefusal.NotYourTurn);
  });

  it("lets the buyer answer the seller's counter, and not the seller again", () => {
    const offers = thread(bob.id, 'buyer', 'seller');
    const counter = offers[1]!;

    expect(policyFor(bob, {}, offers).refusalToRespond(counter)).toBeNull();
    expect(policyFor(alice, {}, offers).refusalToRespond(counter)).toBe(RespondRefusal.NotYourTurn);
  });

  it('lets nobody act once the product has left Available', () => {
    const offers = thread(bob.id, 'buyer');
    const reserved = { status: 'Reserved' as const, buyerId: bob.id };

    expect(policyFor(alice, reserved, offers).refusalToRespond(offers[0]!)).toBe(
      RespondRefusal.NotAvailable,
    );
    expect(policyFor(bob, reserved, offers).refusalToRespond(offers[0]!)).toBe(
      RespondRefusal.NotAvailable,
    );
  });
});

describe('refusalToRespond — only the newest offer in a thread is actionable', () => {
  it('refuses the seller an earlier buyer offer they could once have answered', () => {
    const offers = thread(bob.id, 'buyer', 'seller', 'buyer');
    const policy = policyFor(alice, {}, offers);

    // Both were made by the buyer, so read on their own they are indistinguishable to the seller.
    expect(policy.refusalToRespond(offers[0]!)).toBe(RespondRefusal.Superseded);
    expect(policy.refusalToRespond(offers[2]!)).toBeNull();
  });
});

describe('refusalToRespond — threads are isolated from each other', () => {
  const offers = [
    ...thread(bob.id, 'buyer', 'seller'), // Bob's turn
    ...thread(carol.id, 'buyer'), // Alice's turn
  ];
  const bobsNewest = offers[1]!;
  const carolsNewest = offers[2]!;

  it('lets the seller hold unanswered counters in any number of threads at once', () => {
    const policy = policyFor(alice, {}, offers);

    // Alice already countered Bob and it is his turn, which must not stop her answering Carol.
    expect(policy.refusalToRespond(bobsNewest)).toBe(RespondRefusal.NotYourTurn);
    expect(policy.refusalToRespond(carolsNewest)).toBeNull();
  });

  it("refuses a buyer any offer in another buyer's thread", () => {
    expect(policyFor(carol, {}, offers).refusalToRespond(bobsNewest)).toBe(
      RespondRefusal.NotYourTurn,
    );
  });

  it('leaves whose turn it is in one thread untouched when another buyer acts', () => {
    expect(policyFor(bob, {}, offers).refusalToRespond(bobsNewest)).toBeNull();
  });
});

describe('refusalToRespond — why, not just whether', () => {
  it('is null when the response is allowed', () => {
    const offers = thread(bob.id, 'buyer');
    expect(policyFor(alice, {}, offers).refusalToRespond(offers[0]!)).toBeNull();
  });

  it('reports the product first, since it outranks whose turn it is', () => {
    const offers = thread(bob.id, 'buyer');
    const reserved = { status: 'Reserved' as const, buyerId: bob.id };
    expect(policyFor(alice, reserved, offers).refusalToRespond(offers[0]!)).toBe(RespondRefusal.NotAvailable);
  });

  // The case the offer id exists for: a tab left open across a full round trip still shows the
  // seller's earlier counter with a live Accept, and it is genuinely the buyer's turn again.
  it('reports a stale reference as superseded, not as a turn violation', () => {
    const offers = thread(bob.id, 'buyer', 'seller', 'buyer', 'seller');
    const policy = policyFor(bob, {}, offers);

    // It is Bob's turn either way, so the turn check alone would have let the stale one through.
    expect(policy.refusalToRespond(offers[1]!)).toBe(RespondRefusal.Superseded);
    expect(policy.refusalToRespond(offers[3]!)).toBeNull();
  });

  it('reports the side that cannot answer as out of turn', () => {
    const offers = thread(bob.id, 'buyer');
    expect(policyFor(bob, {}, offers).refusalToRespond(offers[0]!)).toBe(RespondRefusal.NotYourTurn);
  });

  it("reports another buyer's thread as out of turn", () => {
    const offers = thread(bob.id, 'buyer', 'seller');
    expect(policyFor(carol, {}, offers).refusalToRespond(offers[1]!)).toBe(RespondRefusal.NotYourTurn);
  });
});

// Acceptance itself is a write, but everything it is supposed to make true afterwards is readable
// here: the product is Reserved, so no thread on it is actionable and only the winner may buy.
describe('after an offer is accepted', () => {
  const offers = [
    ...thread(bob.id, 'buyer', 'seller'), // Bob accepts this counter
    ...thread(carol.id, 'buyer', 'seller'), // Carol was sitting on one too
  ];
  const bobsNewest = offers[1]!;
  const carolsNewest = offers[3]!;
  const reserved = { status: 'Reserved' as const, buyerId: bob.id, finalPriceCents: 20000 };

  it("freezes the loser's thread even though it was her turn", () => {
    expect(policyFor(carol, {}, offers).refusalToRespond(carolsNewest)).toBeNull();
    expect(policyFor(carol, reserved, offers).refusalToRespond(carolsNewest)).toBe(RespondRefusal.NotAvailable);
  });

  it('freezes the winning thread too — the negotiation is over, not paused', () => {
    expect(policyFor(bob, reserved, offers).refusalToRespond(bobsNewest)).toBe(RespondRefusal.NotAvailable);
    expect(policyFor(alice, reserved, offers).refusalToRespond(carolsNewest)).toBe(RespondRefusal.NotAvailable);
  });

  it('leaves the reserved buyer the purchase, at the accepted price', () => {
    const policy = policyFor(bob, reserved, offers);
    expect(policy.canPurchase).toBe(true);
    expect(policy.purchasePriceCents).toBe(20000);
  });

  it('leaves nobody else anything to do', () => {
    expect(policyFor(carol, reserved, offers).canPurchase).toBe(false);
    expect(policyFor(alice, reserved, offers).canPurchase).toBe(false);
    expect(policyFor(carol, reserved, offers).canStartNegotiation).toBe(false);
  });
});

describe('offerById', () => {
  it('finds an offer on this product', () => {
    const offers = thread(bob.id, 'buyer', 'seller');
    expect(policyFor(alice, {}, offers).offerById(offers[1]!.id)).toBe(offers[1]);
  });

  it('is undefined for an id from another product, which is how a 404 is recognised', () => {
    const offers = thread(bob.id, 'buyer');
    expect(policyFor(alice, {}, offers).offerById(offers[0]!.id + 1000)).toBeUndefined();
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
