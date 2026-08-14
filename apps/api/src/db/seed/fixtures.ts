import type { OfferSide, ProductStatus } from '@linkby/shared';

/** Every seeded account shares one password so the README can publish a single value. */
export const seedPassword = 'password123';

/**
 * Handles (`alice`, `bob`, …) are local aliases so a product or offer can name a user
 * before the database has handed out ids. They are never stored.
 */
export const users = [
  { handle: 'alice', email: 'alice@example.com', displayName: 'Alice' },
  { handle: 'bob', email: 'bob@example.com', displayName: 'Bob' },
  { handle: 'carol', email: 'carol@example.com', displayName: 'Carol' },
] as const;

export type UserHandle = (typeof users)[number]['handle'];

/** `buyer` names the negotiation the offer belongs to; `by` names who wrote it. */
export type SeedOffer = {
  buyer: UserHandle;
  by: OfferSide;
  cents: number;
  minutesAgo: number;
};

export type SeedProduct = {
  seller: UserHandle;
  name: string;
  description: string;
  priceCents: number;
  imageCount: number;
  /** Omitted means `Available`, which the schema requires to have no buyer. */
  status?: ProductStatus;
  buyer?: UserHandle;
  /** Chronological — largest `minutesAgo` first — so turn alternation reads off the page. */
  offers: SeedOffer[];
};

export const products: SeedProduct[] = [
  {
    seller: 'alice',
    name: 'Cast Iron Skillet (Seeded Demo)',
    description:
      'Lodge 12-inch, seasoned and ready to cook on. Minor surface rust on the handle. [Demo: available with no images — shows the placeholder card on the list screen.]',
    priceCents: 4500,
    imageCount: 0,
    offers: [],
  },
  {
    seller: 'alice',
    name: 'Vintage Leica M3 (Seeded Demo)',
    description:
      '1957 double-stroke body, working rangefinder, light brassing on the corners. Strap not included. [Demo: available with several images — the first is the card image, all three show on the detail screen.]',
    priceCents: 285000,
    imageCount: 3,
    offers: [],
  },
  {
    seller: 'bob',
    name: 'Fender Stratocaster (Seeded Demo)',
    description:
      'American Standard in olympic white, rosewood board, original hardshell case. [Demo: carries the maximum of five images, exercising the image cap.]',
    priceCents: 148000,
    imageCount: 5,
    offers: [],
  },
  {
    seller: 'alice',
    name: 'Eames Lounge Chair (Seeded Demo)',
    description:
      'Walnut and black leather, authentic Herman Miller, ottoman included. [Demo: bob has an open offer and nobody has replied — log in as alice to accept or counter.]',
    priceCents: 320000,
    imageCount: 1,
    offers: [{ buyer: 'bob', by: 'buyer', cents: 280000, minutesAgo: 90 }],
  },
  {
    seller: 'alice',
    name: 'Rolleiflex 2.8F (Seeded Demo)',
    description:
      'Planar lens, recently serviced, ground glass is clean. Comes with the original case. [Demo: bob offered and alice countered — log in as bob to accept or counter back.]',
    priceCents: 195000,
    imageCount: 2,
    offers: [
      { buyer: 'bob', by: 'buyer', cents: 150000, minutesAgo: 240 },
      { buyer: 'bob', by: 'seller', cents: 175000, minutesAgo: 200 },
    ],
  },
  {
    seller: 'alice',
    name: 'Peloton Bike Plus (Seeded Demo)',
    description:
      "Barely used, rotating screen, two sets of weights. Collection only. [Demo: two buyers negotiating at once — it is alice's turn to answer bob, and carol's turn to answer alice.]",
    priceCents: 175000,
    imageCount: 2,
    // The two threads interleave: this is the row that proves the history screen sorts
    // across negotiations by timestamp.
    offers: [
      { buyer: 'bob', by: 'buyer', cents: 120000, minutesAgo: 300 },
      { buyer: 'carol', by: 'buyer', cents: 130000, minutesAgo: 260 },
      { buyer: 'carol', by: 'seller', cents: 160000, minutesAgo: 180 },
    ],
  },
  {
    seller: 'alice',
    name: 'Vitsoe 606 Shelving (Seeded Demo)',
    description:
      'Three bays of E-track with twelve shelves and two cabinets. Dismantled, all fixings present. [Demo: a long negotiation — four rounds of back-and-forth with carol, currently awaiting alice.]',
    priceCents: 210000,
    imageCount: 1,
    offers: [
      { buyer: 'carol', by: 'buyer', cents: 140000, minutesAgo: 600 },
      { buyer: 'carol', by: 'seller', cents: 195000, minutesAgo: 540 },
      { buyer: 'carol', by: 'buyer', cents: 160000, minutesAgo: 480 },
      { buyer: 'carol', by: 'seller', cents: 185000, minutesAgo: 400 },
      { buyer: 'carol', by: 'buyer', cents: 172000, minutesAgo: 120 },
    ],
  },
  {
    seller: 'alice',
    name: 'Technics SL-1200 Turntable (Seeded Demo)',
    description:
      "MK2 in silver, new feet and RCA leads, pitch fader is smooth. [Demo: reserved — bob's offer was accepted, and carol's earlier offers stay visible in the history as no longer actionable.]",
    priceCents: 95000,
    imageCount: 2,
    status: 'Reserved',
    buyer: 'bob',
    // bob's accepted offer is last, so nothing post-dates the acceptance.
    offers: [
      { buyer: 'carol', by: 'buyer', cents: 70000, minutesAgo: 800 },
      { buyer: 'carol', by: 'seller', cents: 88000, minutesAgo: 760 },
      { buyer: 'bob', by: 'buyer', cents: 85000, minutesAgo: 700 },
    ],
  },
  {
    seller: 'alice',
    name: 'Brompton C Line (Seeded Demo)',
    description:
      "Six speed in racing green, Brooks saddle, folds down properly. Around 400 miles. [Demo: sold after a negotiation — carol's offer was accepted and the sale completed.]",
    priceCents: 135000,
    imageCount: 1,
    status: 'Sold',
    buyer: 'carol',
    offers: [
      { buyer: 'carol', by: 'buyer', cents: 110000, minutesAgo: 1400 },
      { buyer: 'carol', by: 'seller', cents: 128000, minutesAgo: 1300 },
      { buyer: 'carol', by: 'buyer', cents: 120000, minutesAgo: 1200 },
    ],
  },
  {
    seller: 'bob',
    name: 'Herman Miller Aeron (Seeded Demo)',
    description:
      'Size B, fully loaded with lumbar support and adjustable arms. Ten years old, mesh is intact. [Demo: sold by direct purchase at the listed price — there is no offer behind this sale.]',
    priceCents: 68000,
    imageCount: 1,
    status: 'Sold',
    buyer: 'alice',
    offers: [],
  },
];
