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
  /** File names in ./photos, in display order — the first is the card image. */
  photos: string[];
  /** Omitted means `Available`, which the schema requires to have no buyer. */
  status?: ProductStatus;
  buyer?: UserHandle;
  /** What the sale settled at. Required by the schema whenever `status` is not `Available`. */
  finalPriceCents?: number;
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
    photos: [],
    offers: [],
  },
  {
    seller: 'alice',
    name: 'Woodstock Typewriter (Seeded Demo)',
    description:
      '1940s desk machine, glass-topped keys, carriage return works and the ribbon is fresh. Some paint loss to the frame. [Demo: available with several images — the first is the card image, all three show on the detail screen.]',
    priceCents: 18000,
    photos: ['typewriter-1.jpg', 'typewriter-2.jpg', 'typewriter-3.jpg'],
    offers: [],
  },
  {
    seller: 'bob',
    name: 'Job Lot of Five Antique Vases (Seeded Demo)',
    description:
      'Cut glass, cobalt glass and hand-painted porcelain, all out of one house clearance. One has a chip to the foot. [Demo: carries the maximum of five images, exercising the image cap.]',
    priceCents: 42000,
    photos: [
      'vase-lot-1.jpg',
      'vase-lot-2.jpg',
      'vase-lot-3.jpg',
      'vase-lot-4.jpg',
      'vase-lot-5.jpg',
    ],
    offers: [],
  },
  {
    seller: 'alice',
    name: 'Brockbank Mantel Clock (Seeded Demo)',
    description:
      'Mahogany case with brass finials and a London movement. Winds and runs; pendulum and key included. [Demo: bob has an open offer and nobody has replied — log in as alice to accept or counter.]',
    priceCents: 320000,
    photos: ['mantel-clock-1.jpg'],
    offers: [{ buyer: 'bob', by: 'buyer', cents: 280000, minutesAgo: 90 }],
  },
  {
    seller: 'alice',
    name: 'Vivi-Tone Archtop Guitar (Seeded Demo)',
    description:
      'Sunburst finish with honest playwear, original trapeze tailpiece, neck is straight. [Demo: bob offered and alice countered — log in as bob to accept or counter back.]',
    priceCents: 195000,
    photos: ['guitar-1.jpg', 'guitar-2.jpg'],
    offers: [
      { buyer: 'bob', by: 'buyer', cents: 150000, minutesAgo: 240 },
      { buyer: 'bob', by: 'seller', cents: 175000, minutesAgo: 200 },
    ],
  },
  {
    seller: 'alice',
    name: 'Giltwood Side Chair (Seeded Demo)',
    description:
      "Carved giltwood frame with the original blue silk seat. Sound and steady, collection only. [Demo: two buyers negotiating at once — it is alice's turn to answer bob, and carol's turn to answer alice.]",
    priceCents: 88000,
    photos: ['side-chairs-1.jpg', 'side-chairs-2.jpg'],
    // The two threads interleave: this is the row that proves the history screen sorts
    // across negotiations by timestamp.
    offers: [
      { buyer: 'bob', by: 'buyer', cents: 60000, minutesAgo: 300 },
      { buyer: 'carol', by: 'buyer', cents: 65000, minutesAgo: 260 },
      { buyer: 'carol', by: 'seller', cents: 80000, minutesAgo: 180 },
    ],
  },
  {
    seller: 'alice',
    name: 'Treadle Sewing Machine (Seeded Demo)',
    description:
      'Cast iron base with the original inlaid wooden cover. Treadle turns freely, needs a new belt. [Demo: a long negotiation — four rounds of back-and-forth with carol, currently awaiting alice.]',
    priceCents: 42000,
    photos: ['sewing-machine-1.jpg'],
    offers: [
      { buyer: 'carol', by: 'buyer', cents: 28000, minutesAgo: 600 },
      { buyer: 'carol', by: 'seller', cents: 39000, minutesAgo: 540 },
      { buyer: 'carol', by: 'buyer', cents: 32000, minutesAgo: 480 },
      { buyer: 'carol', by: 'seller', cents: 37000, minutesAgo: 400 },
      { buyer: 'carol', by: 'buyer', cents: 34500, minutesAgo: 120 },
    ],
  },
  {
    seller: 'alice',
    name: 'Carved Cane Armchair (Seeded Demo)',
    description:
      "Scrolled walnut frame with a caned back and seat, crowns carved to the crest rail. [Demo: reserved — bob's offer was accepted, and carol's earlier offers stay visible in the history as no longer actionable.]",
    priceCents: 145000,
    photos: ['armchairs-1.jpg', 'armchairs-2.jpg'],
    status: 'Reserved',
    buyer: 'bob',
    finalPriceCents: 130000,
    // bob's accepted offer is last, so nothing post-dates the acceptance.
    offers: [
      { buyer: 'carol', by: 'buyer', cents: 105000, minutesAgo: 800 },
      { buyer: 'carol', by: 'seller', cents: 135000, minutesAgo: 760 },
      { buyer: 'bob', by: 'buyer', cents: 130000, minutesAgo: 700 },
    ],
  },
  {
    seller: 'alice',
    name: 'Flamenco Guitar (Seeded Demo)',
    description:
      "Spruce top, cypress back and sides, golpeador in place. Set up and playing well. [Demo: sold after a negotiation — carol's offer was accepted and the sale completed.]",
    priceCents: 260000,
    photos: ['flamenco-guitar-1.jpg'],
    status: 'Sold',
    buyer: 'carol',
    finalPriceCents: 235000,
    offers: [
      { buyer: 'carol', by: 'buyer', cents: 210000, minutesAgo: 1400 },
      { buyer: 'carol', by: 'seller', cents: 248000, minutesAgo: 1300 },
      { buyer: 'carol', by: 'buyer', cents: 235000, minutesAgo: 1200 },
    ],
  },
  {
    seller: 'bob',
    name: 'Krups Vivo Espresso Maker (Seeded Demo)',
    description:
      'Steam wand and portafilter, descaled last month, tamper included. [Demo: sold by direct purchase at the listed price — there is no offer behind this sale.]',
    priceCents: 6500,
    photos: ['espresso-maker-1.jpg'],
    status: 'Sold',
    buyer: 'alice',
    finalPriceCents: 6500,
    offers: [],
  },
];
