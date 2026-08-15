import type { ProductViewer, SessionUser } from '@linkby/shared';
import type { offers, products } from '../db/schema';

export type ProductEntity = typeof products.$inferSelect;
export type OfferEntity = typeof offers.$inferSelect;

export type PolicyInput = {
  viewer: SessionUser;
  product: ProductEntity;
  // Every offer on the product. Which are live is the policy's to decide, not a caller's (T-61).
  offers: OfferEntity[];
};

export class ProductPolicy {
  readonly isSeller: boolean;
  private readonly isBuyer: boolean;
  private readonly newestByBuyer: Map<number, OfferEntity>;

  constructor(private readonly input: PolicyInput) {
    this.isSeller = input.viewer.id === input.product.sellerId;
    this.isBuyer = !this.isSeller;
    this.newestByBuyer = input.offers.reduce((newest, offer) => {
      const held = newest.get(offer.buyerId);
      return held && held.id > offer.id ? newest : newest.set(offer.buyerId, offer);
    }, new Map<number, OfferEntity>());
  }

  /** Undefined when that buyer has no thread, which is how an opening offer is recognised. */
  newestInThread(buyerId: number): OfferEntity | undefined {
    return this.newestByBuyer.get(buyerId);
  }

  private get isAvailable(): boolean {
    return this.input.product.status === 'Available';
  }

  private get hasOpenThread(): boolean {
    return Boolean(this.newestInThread(this.input.viewer.id));
  }

  private get isReservedForViewer(): boolean {
    const { product, viewer } = this.input;
    return product.status === 'Reserved' && product.buyerId === viewer.id;
  }

  private isNewestInThread(offer: OfferEntity): boolean {
    return this.newestInThread(offer.buyerId)?.id === offer.id;
  }

  /** The seller answers any buyer's offer, in any of their threads, with no cap on how many. */
  private sellerMayAnswer(offer: OfferEntity): boolean {
    return this.isSeller && offer.madeBy === 'buyer';
  }

  /** A buyer answers only the seller, and only inside their own thread. */
  private buyerMayAnswer(offer: OfferEntity): boolean {
    return this.isBuyer && offer.buyerId === this.input.viewer.id && offer.madeBy === 'seller';
  }

  get canPurchase(): boolean {
    return (
      this.isBuyer && ((this.isAvailable && !this.hasOpenThread) || this.isReservedForViewer)
    );
  }

  get purchasePriceCents(): number | null {
    const { priceCents, finalPriceCents } = this.input.product;
    return this.canPurchase ? (finalPriceCents ?? priceCents) : null;
  }

  get canStartNegotiation(): boolean {
    return this.isBuyer && this.isAvailable && !this.hasOpenThread;
  }

  canCounter(offer: OfferEntity): boolean {
    return (
      this.isAvailable &&
      this.isNewestInThread(offer) &&
      (this.sellerMayAnswer(offer) || this.buyerMayAnswer(offer))
    );
  }

  // Getters do not survive `JSON.stringify`, so the wire shape is stated rather than inherited.
  toViewer(): ProductViewer {
    return {
      canPurchase: this.canPurchase,
      purchasePriceCents: this.purchasePriceCents,
      canStartNegotiation: this.canStartNegotiation,
    };
  }
}
