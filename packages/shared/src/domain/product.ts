/**
 * Domain vocabulary shared by the database schema, the API and the browser, so the three
 * cannot drift. Declared as ordered tuples because Drizzle's `pgEnum` and zod's `z.enum`
 * both take their values that way, and as unions because everything else wants a type.
 */

export const PRODUCT_STATUSES = ['Available', 'Reserved', 'Sold'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * Which side of a negotiation something came from. Contextual, never an attribute of a
 * user: the same person is the seller on their own listing and a buyer on someone else's.
 */
export const OFFER_SIDES = ['buyer', 'seller'] as const;
export type OfferSide = (typeof OFFER_SIDES)[number];

/**
 * How the product list is narrowed. Its own vocabulary rather than the statuses above, because
 * two of the six are about the viewer rather than the product.
 */
export const PRODUCT_VIEWS = {
  All: 'all',
  Available: 'available',
  Reserved: 'reserved',
  Sold: 'sold',
  ListedByMe: 'listed-by-me',
  ReservedForMe: 'reserved-for-me',
} as const;
export type ProductView = (typeof PRODUCT_VIEWS)[keyof typeof PRODUCT_VIEWS];
