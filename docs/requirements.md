# Linkby Marketplace — Canonical Requirements

This is the single source of truth for the exercise.

---

# Part 1 — Product Spec

## 1. Overview

A small marketplace web app where any user can list a product for sale, and any other user can
either buy it outright at the listed price or negotiate the price via back-and-forth offers
before buying. Users are undifferentiated — the same account acts as seller on products it
lists and as buyer on everyone else's.

- Backend: RESTful API, TypeScript on Node.js, PostgreSQL (mandatory).
- Frontend: SPA in React, Vue, or Next.js; JavaScript or TypeScript are both acceptable.
  Defaulting to TypeScript is a project decision for consistency with the backend, not a hard
  requirement.
- Image storage: MinIO (S3-compatible), via Docker.
- Infrastructure/deployment details: see §5.

---

## 2. Domain Rules

### 2.1 Users

- Login only (email + password). No self-registration UI — the database is seeded with test
  users at startup.
- No user-type distinction. Every user can list products (as seller) and act on other users'
  products (as buyer).
- A seller can never buy or negotiate on their own product.

### 2.2 Product fields

Name, description, price (numeric, the "original"/current asking price), up to 5 images
(max 5MB each), seller, status, created timestamp.

### 2.3 Product status lifecycle

```
Available ──(direct purchase)──────────────► Sold
Available ──(an offer gets accepted)───────► Reserved ──(reserved buyer purchases)──► Sold
```

- **Available** — default status on creation. Anyone but the seller may buy it directly or
  open a negotiation.
- **Reserved** — set the instant any offer (buyer's or seller's counter) is _accepted_. The
  product becomes exclusive to that one buyer; every other buyer loses the ability to
  purchase, accept, or counter on this product. Reserved is not tied to a price — it just
  means "this buyer + seller agreed on a price and only they may complete it." By default a
  reservation persists indefinitely if the reserved buyer never completes the purchase (see
  §4 for expiry/cancellation as a bonus).
- **Sold** — set when the reserved (or, if no negotiation occurred, the direct) buyer clicks
  Purchase. Terminal state: no further offers, accepts, or purchases are permitted.
- Transitions must be atomic — implemented as a conditional/guarded DB update (or row lock)
  keyed on current status, so two concurrent purchase/accept attempts can't both succeed.

### 2.4 Price editing

The listed price is fixed at creation and is not editable by the seller in core scope. A
seller who wants to change the price after negotiation has begun must do so by countering
during that negotiation. See §4.2 for an optional bonus that allows editing prior to any
negotiation.

### 2.5 Negotiation

A **negotiation** is a thread scoped to one (product, buyer) pair. A product can have multiple
concurrent negotiation threads (one per interested buyer), but all threads share one
chronological, cross-buyer **history** shown to everyone.

Each **offer** in a thread has: timestamp, buyer (the thread owner), `madeBy` (`buyer` |
`seller`), price. There is no cap on how many offers can go back and forth within a thread.

Rules:

1. A thread's first offer is always buyer-initiated (via the initial **Counter Offer** button).
2. Turns strictly alternate within a thread: after either side makes an offer, that side must
   wait for the other side to Accept or Counter before acting again.
3. Only the **latest** offer in a thread is actionable (Accept / Counter available on it);
   every earlier offer in that thread is history-only.
4. Offers may be above or below the original listed price, in either direction, by either
   party.
5. **Accept** (by whichever side it's the other side's turn for) → product status becomes
   `Reserved`, that thread is closed/won, and every other buyer's thread on this product is
   frozen (still visible, no longer actionable).
6. **Counter** → logs a new offer in the thread with the countering side's price and flips
   whose turn it is.
7. Once `Reserved` or `Sold`, no new offers/accepts are possible on any thread for that
   product.
8. The accepted price is the final purchase price — Purchase does not re-prompt for a price.

---

## 3. UI Requirements

### 3.1 Login

Email, password, Login button. Seeded users only — no registration flow.

### 3.2 Product List (landing page after login)

- Grid of product cards. Each card: first uploaded image (if any), name, initial price,
  seller name, and — only when status is `Reserved` or `Sold` — a status indicator in the
  card's bottom-right corner.
- Click a card → Product Details.
- Header bar: **Sell** (→ Product Registration) and **Logout** (→ Login).
- No pagination required.

### 3.3 Product Registration

Form: name, price, description, up to 5 images (≤5MB each). **Submit** creates the product in
`Available` status. **Cancel** returns to Product List without saving.

### 3.4 Product Details

Shows: name, status, initial price, description, all images. A static display (plain text and
`<img>` tags) is sufficient — no gallery/carousel widget is required.

**Purchase button** — visible & enabled only for a buyer (never the seller) when:

- the product is `Available` and this buyer has not opened a negotiation, **or**
- the product is `Reserved` **for this buyer** (i.e., this buyer's thread is the accepted one).

Hidden once `Sold`. Hidden for a buyer who has an open (not-yet-accepted) negotiation on this
product, since starting a negotiation disables direct purchase at the original price. Hidden
for every buyer except the reserved one once `Reserved`. Clicking it sets status to `Sold` and
navigates back to Product List.

**Counter Offer button (initial)** — visible only when the viewer is a buyer (not the seller)
and has not yet made any offer on this product. Once negotiation begins for that buyer, this
initial button disappears; further Counter/Accept controls live inline in the Negotiation
History.

**Negotiation History section** — appears once at least one offer exists on the product, and
is visible to everyone (the seller and every buyer, not just the thread's originator). Rendered
as a chronological table/timeline across all buyers' threads. Each row shows: timestamp, buyer
name, `madeBy` (buyer/seller), price.

Inline **Accept** / **Counter Offer** controls appear on a row only when:

- it is the **latest** offer in its thread, **and**
- it is currently that viewer's turn to respond — i.e., viewer is the seller and the row was
  made by a buyer, or viewer is the buyer who owns that thread and the row was made by the
  seller.

Counter requires entering a new price; submitting logs it and returns to Product List. Accept
requires no input; submitting sets the product to `Reserved` (with this thread's buyer as the
reserved buyer) and returns to Product List.

---

## 4. Scope

### 4.1 Explicitly out of scope

- Payment processing, transaction history, receipts.
- Inventory/quantity (each listing is exactly one item).
- Register-new-user UI.
- Product search,
- real-time updates,
- reservation expiry/cancellation are all excluded
  from core scope too (refresh/revisit-driven UI is sufficient in their place) — see §4.2,
  where each is listed as a pick-up-if-time bonus.

### 4.2 Bonus / nice-to-haves (only after core is solid)

- Product List status filter (`Available` / `Reserved` / `Sold`).
- Product search.
- Mobile responsiveness.
- "My offers" filter.
- Reservation expiry (auto-release if the reserved buyer never completes purchase).
- Entity-level locking guarantees beyond the atomic-update requirement in §2.3/§6.
- Real-time offer/status updates (websockets/SSE) instead of refresh-driven.
- Price editing: allow the seller to edit the price while the product is `Available` **and**
  no buyer has yet opened a negotiation on it (i.e., zero offers exist across all buyers).
  Once any buyer starts negotiating, the listed price would still be frozen even under this
  bonus.

---

# Part 2 — Engineering

## 5. Tech Stack & Infrastructure

| Layer                    | Choice                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Backend language/runtime | TypeScript on Node.js                                                                        |
| API framework            | Express or Hono (candidate's choice)                                                         |
| Database                 | PostgreSQL                                                                                   |
| Object storage           | MinIO (S3-compatible), via Docker                                                            |
| Frontend                 | React, Vue, or Next.js — JS or TS allowed; TS is the project's chosen default                |
| UI components            | Free choice — a component library (e.g. MaterialUI, Vuetify) or plain HTML/CSS are both fine |
| Containerization         | Docker Compose for local dev; images structured to be AWS-deployable                         |

- Everything (API, DB, MinIO, frontend) must run on a reviewer's local machine via Docker.
- No real AWS deployment is required, but the design should not preclude one — e.g., MinIO
  stands in for S3 so swapping to real S3 in AWS is a config change, not a rewrite.
- Seed script populates test seller/buyer users (and can optionally seed sample products) on
  startup for reviewer convenience.
- Scalability is an explicit evaluation criterion, not just "make it run": an API that's
  stateless/horizontally-scalable (no in-memory session or in-process state that breaks with
  > 1 instance), indexed columns for the hot query paths (product list by status, offers by
  > product+buyer), and avoiding N+1 query patterns for the negotiation history view.

---

## 6. Testing

Unit tests are expected for core business logic, at minimum:

- Direct purchase (happy path + blocked paths: seller-buys-own, already-reserved-for-other,
  already-sold, negotiation-in-progress).
- Counter-offer flow (turn alternation enforcement, only-latest-offer-actionable, accept →
  reserved, multi-buyer thread isolation).
- Atomicity of concurrent purchase/accept attempts on the same product.

---

## 7. Deliverables & Submission

- Single GitHub repository. Internal file/folder structure and URL routing are entirely the
  candidate's choice.
- **Submission logistics (do this last, when actually done):** either (a) make the repo
  private and grant access to GitHub users `andrewchak` and `derik-linkby`, or (b) make the
  repo public and email the URL to derik@linkby.com to notify them of submission.
- `README.md`: comprehensive local setup + run instructions, dependencies, seeded test
  credentials.
- `CLAUDE.md` (already present).
- This `requirements.md` as the canonical spec (the "what").
- An implementation plan doc — build order and milestones (the "how/when"): e.g. schema →
  seed/Docker → auth → product CRUD → negotiation engine → history UI → bonus items.
- Design-decisions doc (or section) covering alternatives considered and why, plus
  optimization/improvement ideas if more time were available.
- Git history with commits at meaningful milestones (not one giant commit).
- Deployment notes: what would be needed to actually run this on AWS, even though it isn't
  being deployed there for submission.

---

## 8. Constraints & Assessment Context

- **Time budget:** 2 days total. Late submission is penalized, so a partial-but-working
  submission on time beats a complete one that's late — build core functionality first
  (Part 1) before touching anything in the Bonus list (§4.2).
- **The UI does not need to be beautiful.** Covering all required functionality correctly
  matters far more than visual design — spend limited time there before spending it on
  styling.
- What's actually being assessed, so effort is spent where it's graded: understanding of
  SDLC; coding best practices (unit tests, sensible design patterns — not over-engineering);
  scalability/schema/query efficiency (§5); and the ability to deliver working, quality
  software under a hard time constraint. There's no single "right" solution — reasonable,
  well-justified tradeoffs count in the candidate's favor, which is why §7 asks for a
  decisions-with-alternatives writeup rather than just code.
