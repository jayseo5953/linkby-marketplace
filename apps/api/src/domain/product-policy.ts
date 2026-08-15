import type { ProductViewer, SessionUser } from '@linkby/shared';
import type { products } from '../db/schema';

/**
 * The §3.4 rules, in one place. The detail endpoint runs this to say what a viewer may do and the
 * purchase endpoint runs it again against the locked row to enforce it, so a button that is drawn
 * and a request that is accepted cannot disagree except by staleness (T-54).
 */

/** The row as the schema defines it, so no hand-written subset can drift from the table. */
export type ProductEntity = typeof products.$inferSelect;

export type PolicyInput = {
  viewer: SessionUser;
  product: ProductEntity;
  /** Whether this viewer has ever made an offer here. Threads only ever close by acceptance (§2.5). */
  viewerHasNegotiation: boolean;
};

export class ProductPolicy {
  private readonly isSeller: boolean;

  constructor(private readonly input: PolicyInput) {
    this.isSeller = input.viewer.id === input.product.sellerId;
  }

  get canPurchase(): boolean {
    const { viewer, product, viewerHasNegotiation } = this.input;

    return (
      !this.isSeller &&
      ((product.status === 'Available' && !viewerHasNegotiation) ||
        (product.status === 'Reserved' && product.buyerId === viewer.id))
    );
  }

  get purchasePriceCents(): number | null {
    const { priceCents, finalPriceCents } = this.input.product;
    return this.canPurchase ? (finalPriceCents ?? priceCents) : null;
  }

  // Getters do not survive `JSON.stringify`, so the wire shape is stated rather than inherited.
  toViewer(): ProductViewer {
    return { canPurchase: this.canPurchase, purchasePriceCents: this.purchasePriceCents };
  }
}
