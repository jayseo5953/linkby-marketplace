import type { ProductViewer, SessionUser } from '@linkby/shared';
import type { offers, products } from '../db/schema';

export type ProductEntity = typeof products.$inferSelect;
export type OfferEntity = typeof offers.$inferSelect;

// A refusal's value is the code the caller receives.
export enum PurchaseRefusal {
  OwnProduct = 'OWN_PRODUCT',
  NotAvailable = 'PRODUCT_NOT_AVAILABLE',
  NegotiationOpen = 'NEGOTIATION_OPEN',
}

export enum NegotiationRefusal {
  OwnProduct = 'OWN_PRODUCT',
  NotAvailable = 'PRODUCT_NOT_AVAILABLE',
  ThreadOpen = 'THREAD_ALREADY_OPEN',
}

export enum RespondRefusal {
  NotAvailable = 'PRODUCT_NOT_AVAILABLE',
  Superseded = 'OFFER_SUPERSEDED',
  NotYourTurn = 'NOT_YOUR_TURN',
}

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

  /** Resolves within this product's offers, so an id from another product is simply absent. */
  offerById(id: number): OfferEntity | undefined {
    return this.input.offers.find((offer) => offer.id === id);
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

  isNewestInThread(offer: OfferEntity): boolean {
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

  // Ordered: the least recoverable rule reports first.
  private firstUnmet<R>(required: readonly (readonly [boolean, R])[]): R | null {
    return required.find(([holds]) => !holds)?.[1] ?? null;
  }

  refusalToPurchase(): PurchaseRefusal | null {
    if (this.isSeller) return PurchaseRefusal.OwnProduct;
    // The one disjunction: the reserved buyer buys despite both rules below.
    if (this.isReservedForViewer) return null;

    return this.firstUnmet([
      [this.isAvailable, PurchaseRefusal.NotAvailable],
      [!this.hasOpenThread, PurchaseRefusal.NegotiationOpen],
    ]);
  }

  get canPurchase(): boolean {
    return this.refusalToPurchase() === null;
  }

  get purchasePriceCents(): number | null {
    const { priceCents, finalPriceCents } = this.input.product;
    return this.canPurchase ? (finalPriceCents ?? priceCents) : null;
  }

  refusalToStartNegotiation(): NegotiationRefusal | null {
    return this.firstUnmet([
      [this.isBuyer, NegotiationRefusal.OwnProduct],
      [this.isAvailable, NegotiationRefusal.NotAvailable],
      [!this.hasOpenThread, NegotiationRefusal.ThreadOpen],
    ]);
  }

  get canStartNegotiation(): boolean {
    return this.refusalToStartNegotiation() === null;
  }

  // Accepting and countering are permitted under identical conditions.
  refusalToRespond(offer: OfferEntity): RespondRefusal | null {
    return this.firstUnmet([
      [this.isAvailable, RespondRefusal.NotAvailable],
      [this.isNewestInThread(offer), RespondRefusal.Superseded],
      [this.sellerMayAnswer(offer) || this.buyerMayAnswer(offer), RespondRefusal.NotYourTurn],
    ]);
  }

  canRespondTo(offer: OfferEntity): boolean {
    return this.refusalToRespond(offer) === null;
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
