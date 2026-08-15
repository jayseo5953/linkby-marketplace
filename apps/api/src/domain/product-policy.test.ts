import type { SessionUser } from '@linkby/shared';
import { describe, expect, it } from 'vitest';
import { type PolicyInput, type ProductEntity, ProductPolicy } from './product-policy';

const alice: SessionUser = { id: 1, email: 'alice@example.com', displayName: 'Alice' };
const bob: SessionUser = { id: 2, email: 'bob@example.com', displayName: 'Bob' };
const carol: SessionUser = { id: 3, email: 'carol@example.com', displayName: 'Carol' };

// Alice sells everything here, so `viewer: alice` is the seller case in every row below.
function inputFor(
  viewer: SessionUser,
  product: Partial<ProductEntity>,
  viewerHasNegotiation = false,
): PolicyInput {
  return {
    viewer,
    product: {
      sellerId: alice.id,
      status: 'Available',
      buyerId: null,
      priceCents: 25000,
      finalPriceCents: null,
      // Present because the row type is the whole row; no rule reads any of these.
      id: 1,
      name: 'Vintage Camera',
      description: 'A camera.',
      imageKeys: [],
      createdAt: new Date('2026-08-15T00:00:00Z'),
      ...product,
    },
    viewerHasNegotiation,
  };
}

const canPurchase = (...args: Parameters<typeof inputFor>) =>
  new ProductPolicy(inputFor(...args)).canPurchase;

// Rows are numbered as in wireframes.md §4.4, so a change to that table has an obvious counterpart.
describe('canPurchase — §4.4 truth table', () => {
  it('1. hides from the seller on an Available product', () => {
    expect(canPurchase(alice, { status: 'Available' })).toBe(false);
  });

  it('2. hides from the seller on a Reserved product', () => {
    expect(canPurchase(alice, { status: 'Reserved', buyerId: bob.id })).toBe(false);
  });

  it('3. hides from the seller on a Sold product', () => {
    expect(canPurchase(alice, { status: 'Sold', buyerId: bob.id })).toBe(false);
  });

  it('4. offers it to a buyer with no negotiation', () => {
    expect(canPurchase(bob, { status: 'Available' })).toBe(true);
  });

  it('5. hides it from a buyer who has opened a negotiation', () => {
    expect(canPurchase(bob, { status: 'Available' }, true)).toBe(false);
  });

  it('6. offers it to the reserved buyer, despite their negotiation', () => {
    expect(canPurchase(bob, { status: 'Reserved', buyerId: bob.id }, true)).toBe(true);
  });

  it('7. hides it from a buyer whose own thread lost the reservation', () => {
    expect(canPurchase(carol, { status: 'Reserved', buyerId: bob.id }, true)).toBe(false);
  });

  it('8. hides it from an uninvolved buyer while reserved', () => {
    expect(canPurchase(carol, { status: 'Reserved', buyerId: bob.id })).toBe(false);
  });

  it('9. hides it from everyone once sold, including the buyer who bought it', () => {
    expect(canPurchase(bob, { status: 'Sold', buyerId: bob.id })).toBe(false);
    expect(canPurchase(carol, { status: 'Sold', buyerId: bob.id })).toBe(false);
  });
});

describe('purchasePriceCents', () => {
  it('charges the listed price on a direct purchase', () => {
    const policy = new ProductPolicy(inputFor(bob, { status: 'Available', priceCents: 25000 }));
    expect(policy.purchasePriceCents).toBe(25000);
  });

  it('charges the accepted price, not the listing, when reserved', () => {
    const policy = new ProductPolicy(
      inputFor(bob, {
        status: 'Reserved',
        buyerId: bob.id,
        priceCents: 25000,
        finalPriceCents: 22000,
      }),
    );

    expect(policy.purchasePriceCents).toBe(22000);
  });

  it('is null whenever the purchase is refused, so no price can be shown', () => {
    const policy = new ProductPolicy(inputFor(alice, { status: 'Available' }));
    expect(policy.canPurchase).toBe(false);
    expect(policy.purchasePriceCents).toBeNull();
  });
});

describe('toViewer', () => {
  it('states the wire shape rather than exposing the instance', () => {
    const policy = new ProductPolicy(inputFor(bob, { status: 'Available', priceCents: 4500 }));
    expect(policy.toViewer()).toEqual({ canPurchase: true, purchasePriceCents: 4500 });
  });
});
