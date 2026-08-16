# Linkby Marketplace — Tasks

Canonical spec: [`requirements.md`](./requirements.md). Where this doc and the spec disagree, the spec wins.

---

## How to read this list

**What these tickets are.** Granular delivery goals, not an implementation plan. Each one states the
outcome and how to verify it, and says nothing about how to build it — that is deliberate. Before a
ticket is implemented, its design is discussed and agreed, and whatever that settles is recorded in
[`decision-logs.md`](./decision-logs.md).

**Status** — every ticket carries one line: `Not started`, `In progress`, `Blocked` or `Done`. A ticket
reaches `Done` only once its QA steps have actually been run, and the `QA:` note records when, plus
anything that was not fully verified.

**Build order.** Tickets are listed by ID, but P0 is built backend-first: **LM-06 → LM-07 → LM-11 →
LM-13 → LM-14 → LM-15**, then the frontend run **LM-05 → LM-08 → LM-09 → LM-10 → LM-12 → LM-16**.
Every ticket's stated dependencies are satisfied in that sequence.

**Priority bands**

| Band | Meaning |
| --- | --- |
| **P0** | Core functionality. The submission is not credible without it. |
| **P1** | Required deliverables and core hardening (§6 tests, §7 docs, submission). |
| **P2** | §4.2 bonuses. Touch only when everything above is green. |

**Conventions used in QA steps** — these are QA harness assumptions, not design mandates. Substitute whatever
the implementation actually chose:

- Web app: `http://localhost:5173` · API: `http://localhost:3000` · Postgres: `postgres://linkby:linkby@localhost:5432/linkby` · MinIO console: `http://localhost:9001`
- REST paths in `curl` examples (`/api/products`, `/api/offers`, …) are illustrative. §7 leaves routing to the
  implementer — if routes differ, keep the *shape* of the check (same inputs, same expected status/body) and
  adjust the URL.
- `$TOKEN_ALICE` etc. = whatever credential the auth ticket issues, carried however the implementation carries it.
- **Being two users at once:** use one normal Chrome window for user A and one **incognito window** for user B.
  Incognito has a separate storage partition, so both sessions stay live simultaneously. Never use two tabs of the
  same profile — they share the session and the second login silently replaces the first. Where a ticket needs
  three users, add a second incognito profile or fall back to an explicit logout → login sequence, stated per ticket.

**Seed identity contract** (owned by LM-03, referenced by every QA script below):

| Email | Password | Display name | Role in QA scenarios |
| --- | --- | --- | --- |
| `alice@example.com` | `password123` | Alice | Seller in most scenarios |
| `bob@example.com` | `password123` | Bob | Primary buyer |
| `carol@example.com` | `password123` | Carol | Second buyer (multi-thread / exclusion tests) |

---

# P0 — Core

## LM-01 · Runnable skeleton on Docker Compose

**Priority:** P0 · **Estimate:** 2h · **Depends on:** —
**Status:** Done · **QA:** passed 2026-08-14 — step 4 partial, bucket confirmed via the S3 API rather than the console UI

> As a reviewer, I want to bring the whole system up with one command on my own machine, so that I can evaluate
> the app without hand-assembling infrastructure.

**Acceptance criteria**

- [x] A single documented command brings up API, database, object storage and the web app together.
- [x] The API exposes a health endpoint that reports its own liveness and its database connectivity.
- [x] The web app loads in a browser and can reach the API (no CORS/origin errors in the console).
- [x] Object storage starts with its bucket already created — no manual console step required.
- [x] Configuration (DB connection, storage endpoint/credentials, API base URL) comes from environment
      variables with working defaults, so swapping storage for real S3 later is config-only (§5).
- [x] Bringing the stack down and up again does not lose database contents.

**QA steps** — *backend/infra*

1. From a clean checkout: `docker compose up -d`, then wait for containers to report healthy.
2. `curl -i http://localhost:3000/health` → `200`, body reports database reachable.
3. `psql postgres://linkby:linkby@localhost:5432/linkby -c "select 1;"` → returns one row.
4. Open `http://localhost:9001` → storage console loads and the app bucket is listed.
5. Open `http://localhost:5173` in Chrome → page renders; DevTools console shows no network/CORS errors.
6. `docker compose down && docker compose up -d`, re-run step 3 → still succeeds.

---

## LM-02 · Data model, migrations and hot-path indexes

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-01
**Status:** Done · **QA:** passed 2026-08-14 — all 9 steps; every CHECK, enum, unique index and FK delete rule exercised by a failing insert or delete

> As an engineer, I want a schema that models users, products, images, negotiations and offers with the
> right constraints, so that the domain rules in §2 are enforceable at the data layer rather than only in UI code.

**Acceptance criteria**

- [x] Migrations run on `docker compose up` against a clean database, and are idempotent on re-run.
- [x] Users, products, product images and offers are all represented. A negotiation has no table of its own — it
      is identified by the (product, buyer) pair its offers carry, so a duplicate negotiation is not representable.
- [x] Product carries: name, description, price, seller, status, created timestamp — and names the **buyer it is
      committed to**, set both when an offer is accepted and when a buyer purchases outright.
- [x] Product status is constrained to exactly `Available` / `Reserved` / `Sold`; no other value can be stored.
- [x] An offer records: timestamp, the negotiation it belongs to (product + buyer), `madeBy` side
      (`buyer`/`seller`), price.
- [x] Money is stored as integer cents — an exact type, never a float — and cannot be zero or negative.
- [x] CHECK constraints hold the schema-level invariants: a product names a buyer exactly when it is no longer
      `Available`, that buyer is never the seller, and a product carries at most 5 images.
- [x] Indexes exist for the hot paths named in §5: products by status, offers by product + buyer.
- [x] Foreign keys are declared with sensible delete behaviour; a product cannot reference a non-existent seller.

**QA steps** — *backend/SQL*

1. `docker compose down -v && docker compose up -d` (clean volume) → the migration service exits 0 and the API
   starts behind it.
2. `psql $DB -c "\d products"` → confirm columns, the status enum type, the seller FK and the CHECK constraints.
3. `psql $DB -c "\di"` → confirm an index on product status and one on offers by product+buyer.
4. Negative test: `psql $DB -c "insert into products (name, price_cents, status, seller_id) values ('x', 1, 'Frozen', <valid_id>);"`
   → **rejected**, no such value in the status enum.
5. Negative test: insert a product with status `Reserved` and a null `buyer_id`, then one with status `Available`
   and a `buyer_id` set → both **rejected** by the buyer CHECK.
6. Negative test: insert a product with 6 image keys → **rejected** by the image-count CHECK.
7. Negative test: an offer with `amount_cents = 0`, one with an unknown `made_by`, and one referencing a
   nonexistent product or buyer → all four **rejected**.
8. Delete behaviour: deleting a user who is a seller, an offer's buyer, or a product's committed buyer →
   **rejected** by RESTRICT in each case. Deleting a product with offers → succeeds, and its offers go with it.
9. `docker compose down && docker compose up -d` (keeping the volume) → migrations re-run with no error and no
   duplicate objects; step 2 still shows one of each.

---

## LM-03 · Seed data (test users + sample products)

**Priority:** P0 · **Estimate:** 2h · **Depends on:** LM-02

**Status:** Done · **QA:** passed 2026-08-14 — all 8 steps from a cold start with no images and no
volumes; alternation, buyer-is-never-seller and key-to-object reconciliation asserted by query
rather than checked by eye

> As a reviewer, I want the database pre-populated with known users and a spread of products that between them
> cover every product and negotiation state, so that I can log in and exercise the app immediately — and see each
> state rendered — without creating data by hand (there is no registration UI, §2.1).

**Seed product matrix** — every product's name ends `(Seeded Demo)` and its description states what it
demonstrates, so the state is legible from the UI without consulting this table.

| # | Seller | Status | Images | Negotiation state |
| --- | --- | --- | --- | --- |
| 1 | alice | Available | 0 | none — exercises the placeholder card |
| 2 | alice | Available | 3 | none |
| 3 | bob | Available | 5 | none — exercises the 5-image cap |
| 4 | alice | Available | 1 | bob has an open offer; **seller's turn** |
| 5 | alice | Available | 2 | bob offered, alice countered; **buyer's turn** |
| 6 | alice | Available | 2 | bob and carol both negotiating, at opposite turns |
| 7 | alice | Available | 1 | carol, four rounds of back-and-forth |
| 8 | alice | Reserved | 2 | bob's offer accepted; carol's losing offers remain in history |
| 9 | alice | Sold | 1 | carol's offer accepted |
| 10 | bob | Sold | 1 | none — alice purchased outright, so there is no offer behind the sale |

**Acceptance criteria**

- [x] Seeding runs on startup (or via one documented command) and is safe to run repeatedly — re-running produces
      no duplicate users, products or offers.
- [x] The three users in the seed identity contract above exist with those exact emails, passwords and display names.
- [x] Passwords are stored hashed, never in plaintext.
- [x] The ten products above exist, matching the matrix on seller, status, image count and negotiation state.
- [x] Every product name ends `(Seeded Demo)` and its description names the state it demonstrates.
- [x] Products 8–10 each name a committed buyer; products 1–7 name none.
- [x] Seeded offer sequences satisfy the rules the negotiation engine will later enforce — turns alternate, only
      the newest offer in a pair is actionable, and no offer post-dates the acceptance that reserved the product.
- [x] Every key in `image_keys` resolves to an object that actually exists in the bucket.
- [x] Seeded credentials are the same values that LM-17 publishes in the README.

**QA steps** — *backend/SQL*

1. `docker compose down -v && docker compose up -d`, wait for seeding.
2. `psql $DB -c "select email, display_name from users order by email;"` → exactly the three contract users.
3. `psql $DB -c "select password_hash from users limit 1;"` → value is a hash, **not** `password123`.
4. `psql $DB -c "select id, name, status, seller_id, cardinality(image_keys) from products order by id;"` → ten
   rows matching the matrix, names all suffixed `(Seeded Demo)`, two distinct sellers.
5. `psql $DB -c "select id, status, buyer_id from products where buyer_id is not null;"` → exactly products 8, 9
   and 10, none of them `Available`.
6. `psql $DB -c "select product_id, buyer_id, made_by, amount_cents, created_at from offers order by product_id, id;"`
   → sequences match the matrix; within each (product, buyer) pair `made_by` alternates and timestamps ascend.
7. For one key from each seeded product: `mc stat local/$S3_BUCKET/<key>` → the object exists.
8. Re-run the seed command → steps 4 and 6 return identical row counts (no duplication).

---

## LM-04 · Login API and stateless session

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-03
**Status:** Done · **QA:** passed 2026-08-14 — 16 checks, all six ticket steps plus expiry, forged and
tampered tokens, a token naming a deleted user, timing parity between the two failure modes, and log hygiene

> As a seeded user, I want to exchange my email and password for a credential the API accepts, so that the system
> can tell who is acting and enforce the buyer/seller rules.

**Acceptance criteria**

- [x] Correct email + password returns a success response carrying a session credential and the user's identity
      (id, email, display name) — never the password hash.
- [x] Wrong password, unknown email and malformed input are all rejected with an auth/validation error, and the
      error message does not reveal whether the email exists.
- [x] A protected endpoint returns the caller's identity when given a valid credential.
- [x] A protected endpoint rejects a missing, malformed or expired credential with `401`.
- [x] Session state is **not** held in API process memory — a second API instance accepts a credential issued by
      the first (§5 statelessness requirement).
- [ ] Every subsequent write endpoint derives the acting user from the credential, never from a client-supplied
      user id in the body. — *the middleware and `requireUser` accessor that make this possible ship here; the
      criterion itself is a constraint on LM-06 onwards and is ticked when the last write endpoint lands.*

**QA steps** — *backend/curl*

1. `curl -i -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"alice@example.com","password":"password123"}'`
   → `200`, body contains a credential + Alice's identity, and contains no password field.
2. Same call with `"password":"wrong"` → `401`, generic message.
3. Same call with `"email":"nobody@example.com"` → `401` with the **same** generic message as step 2.
4. `curl -i http://localhost:3000/api/me -H "Authorization: Bearer $TOKEN_ALICE"` → `200`, identifies Alice.
5. `curl -i http://localhost:3000/api/me` (no header) → `401`. Repeat with `Authorization: Bearer garbage` → `401`.
6. Statelessness: `docker compose restart api`, then re-run step 4 with the *same* token → still `200`
   (proves the session is not in-process memory). Confirm `/health` reports a reset `uptimeSeconds`, so the
   token is being accepted by a genuinely new process.
7. Expiry: sign a token with the real `JWT_SECRET` and an `exp` in the past, then call `/api/me` with it →
   `401` with code `TOKEN_EXPIRED`. Steps 1–6 cannot reach the expiry criterion without waiting 24 hours.

---

## LM-05 · Login and logout in the browser

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-04
**Status:** Done · **QA:** 2026-08-15 — every step but 3, which needs a password typed into the form.

> As a user, I want to log in on a login screen and log out from the header, so that I can start and end a session
> in the app (§3.1).

**Delivered as** the web foundation the remaining screens build on: react-router over the four
wireframed routes behind a session gate, TanStack Query for server state, an auth context over a
`localStorage` session, shadcn/ui primitives, and a fetch client split into transport (`lib/http.ts`)
and per-resource endpoint modules (`src/api`). The login endpoint now answers every rejection
identically, so the screen cannot leak which addresses exist.

**Acceptance criteria**

- [x] Login screen shows email field, password field and a Login button; password input is masked.
- [ ] Valid seeded credentials navigate to the Product List.
- [x] Invalid credentials keep the user on the login screen and display a visible error message.
- [x] After login, a header bar with **Sell** and **Logout** is present on the authenticated screens (§3.2).
- [x] Reloading the page while logged in keeps the user logged in — it does not bounce back to login.
- [x] Logout returns to the login screen, and browser-Back afterwards does not restore an authenticated screen.
- [x] Navigating directly to an authenticated URL while logged out redirects to login.
- [x] Login is disabled until both fields are filled, and a rejection clears the password but keeps the email.
- [x] A `401` on a request that carried a token clears the session and returns to login, so no
      authenticated state survives it.

**QA steps** — *browser*

1. Chrome → `http://localhost:5173`. Redirected to `/login`; both fields render and **Login** is
   disabled. Fill only the email → still disabled.
2. Enter `alice@example.com` / `wrongpass`, click **Login** → stays on login, shows the server's own
   "Email or password is incorrect.", email kept, password cleared, **Login** disabled again.
3. Enter `alice@example.com` / `password123`, click **Login** → lands on Product List; header shows **Sell** and **Logout**.
4. Press browser reload → still on Product List, still logged in.
5. Click **Sell**, then open `/products/1`, then `/no-such-page` → the three placeholders and the
   "Page not found" screen; the header stays put on the authenticated ones.
6. Corrupt the stored token — DevTools console:
   `s=JSON.parse(localStorage['linkby.session']); s.token=s.token.slice(0,-4)+'AAAA'; localStorage['linkby.session']=JSON.stringify(s)`
   — then reload and open any screen that calls the API → back on login with `linkby.session` gone.
7. Click **Logout** → login screen. Press browser Back → still login screen (or redirected there), not the product list.
8. While logged out, paste the Product List URL into the address bar and hit Enter → redirected to login.
9. The endpoint answers every rejection identically — wrong password, unknown email and a malformed
   body all return the same `401 INVALID_CREDENTIALS` body:
   `curl -i -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"x"}'`
   and again with `-d '{"email":"alice@example.com"}'`.

---

## LM-06 · Create a product with images

**Priority:** P0 · **Estimate:** 2.5h · **Depends on:** LM-04
**Status:** Done · **QA:** passed 2026-08-14 — all 9 steps, plus zero-price, disallowed-MIME and a
forced insert failure confirming uploaded objects are cleaned up.

> As a seller, I want to list a product with a name, price, description and up to five images, so that other users
> can see and buy it (§2.2, §3.3).

**Acceptance criteria**

- [x] An authenticated user can create a product; it is stored with status `Available` and the caller as seller (§3.3).
- [x] Up to 5 images are accepted per product; a 6th is rejected with a clear validation error.
- [x] An image over 5MB is rejected with a clear validation error; nothing partial is persisted.
- [x] Images are stored in object storage, not in the database; the database holds references plus their display order.
- [x] Image order is stable, so "first uploaded image" is deterministic for the card thumbnail in LM-08.
- [x] Stored images are retrievable by the browser via a URL that works for any logged-in viewer.
- [x] Missing name, **missing description**, missing price, non-numeric price and negative price are all rejected
      with `400` *(description required)*.
- [x] A product with zero images is valid and created successfully — images are optional
      *(§3.2 already shows the card image only "if any")*.
- [x] Unauthenticated create attempts are rejected with `401`.

**QA steps** — *backend/curl + storage console*

1. `curl -i -X POST http://localhost:3000/api/products -H "Authorization: Bearer $TOKEN_ALICE" -F 'name=Test Chair' -F 'priceCents=12000' -F 'description=A chair' -F 'images=@a.jpg' -F 'images=@b.jpg'`
   → `201`, body shows status `Available` and Alice as seller.
2. `psql $DB -c "select name, price_cents, status, seller_id from products where name='Test Chair';"` → one row, `Available`, `price_cents` 12000.
3. `psql $DB -c "select image_keys from products where name='Test Chair';"` → 2 keys, in upload order.
4. Open the MinIO console → both objects present in the app bucket.
5. `curl -i <image_url_from_step_1>` → `200` with an image content type.
6. Repeat step 1 with six `-F 'images=@…'` flags → `400`, and `select count(*) from products where name=…` → 0 (nothing partially created).
7. `dd if=/dev/zero of=big.jpg bs=1m count=6` then post it → `400` size error, nothing persisted.
8. Repeat step 1 with `-F 'priceCents=-5'` → `400`; likewise `priceCents=0`, `priceCents=abc` and `priceCents=120.00`,
   since the field is whole cents. With no `name` → `400`. With no `description` → `400`. With a valid
   name/priceCents/description but **no image parts at all** → `201` (images optional).
9. Repeat step 1 with no `Authorization` header → `401`.

---

## LM-07 · Read products (list + detail)

**Priority:** P0 · **Estimate:** 1h · **Depends on:** LM-06
**Status:** Done · **QA:** passed 2026-08-15 — all 6 steps, plus a no-image product returning `imageUrl: null` and four malformed ids all leaving by the same 404.

> As a logged-in user, I want to fetch all listings and the full detail of one listing, so that the browsing screens
> have data to render (§3.2, §3.4).

**Acceptance criteria**

- [x] A list endpoint returns every product with: first image reference, name, price, seller display name, status,
      created timestamp.
- [x] Seller display name comes back with the list in a single query — no per-product follow-up query (§5, no N+1).
- [x] A detail endpoint returns one product with name, status, price, description, **all** image references and seller.
- [x] Detail carries the raw identity columns the UI needs to resolve button visibility for itself — `seller.id` and
      `buyerId` — rather than per-viewer flags. Both endpoints return the same bytes to every caller; the viewer's own
      negotiation state comes from the history read model (LM-15).
- [x] An unknown product id returns `404`.
- [x] Both endpoints require authentication.
- [x] No pagination is implemented (explicitly not required, §3.2).

**QA steps** — *backend/curl*

1. `curl -s http://localhost:3000/api/products -H "Authorization: Bearer $TOKEN_BOB" | jq` → array containing the
   seeded products, each with `seller`, `status`, `imageUrl` and a price.
2. `curl -s http://localhost:3000/api/products/<id> -H "Authorization: Bearer $TOKEN_BOB" | jq` → full detail with
   the complete image array, and `buyerId` set on a `Reserved` product.
3. As the seller: same detail call with `$TOKEN_ALICE` → byte-identical to Bob's response. She is the seller because
   `seller.id` is her own user id, which the client compares against its session.
4. `curl -i http://localhost:3000/api/products/00000000-0000-0000-0000-000000000000 -H "Authorization: Bearer $TOKEN_BOB"` → `404`.
5. `curl -i http://localhost:3000/api/products` (no auth) → `401`.
6. N+1 check: with DB statement logging on (`docker compose logs -f db`), call the list endpoint once →
   the log shows a small constant number of queries, not one per product.

---

## LM-08 · Product List screen

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-05, LM-07
**Status:** Done · **QA:** 2026-08-15 — every criterion but the empty state, which needs the
products table cleared.

> As a logged-in user, I want to see all listings as a grid of cards, so that I can find something to buy (§3.2).

**Acceptance criteria**

- [x] Landing screen after login is the Product List.
- [x] Each card shows the first uploaded image (if any), name, price and seller name.
- [x] A status indicator appears in the card's bottom-right corner for every status, `Available`
      included, weighted so `Sold` reads heaviest and `Available` lightest.
- [x] Clicking a card navigates to that product's detail screen.
- [x] Header bar has **Sell** (→ registration) and **Logout** (→ login).
- [x] A product with no images renders without a broken-image icon.
- [ ] Empty state (no products at all) renders a message rather than a blank page or an error.
- [x] A failed fetch shows a message and a **Retry** that recovers in place, and the header stays
      interactive throughout loading and failure (§2b, §2c).
- [x] The grid is one column on a phone with nothing overflowing horizontally and no control hidden.

**QA steps** — *browser*

1. Log in as Bob (`bob@example.com` / `password123`) → Product List renders as a grid of cards.
2. On any card, confirm image, name, price and seller name are all visible.
3. Confirm every `Available` card carries an outlined **Available** badge, distinct from the filled
   `Reserved` and solid `Sold` ones.
4. Set one product aside for status display: `psql $DB -c "update products set status='Sold' where name='<pick one>';"`,
   reload the page → that card now shows a status indicator in its **bottom-right** corner. Repeat with `'Reserved'`.
   Restore with `update products set status='Available' …`.
5. Click a card → navigates to the detail screen for that product.
6. Click **Sell** in the header → registration screen. Go back, click **Logout** → login screen.
7. Confirm a seeded product with no images (`Cast Iron Skillet`) renders a muted parcel icon on a
   neutral block, not a broken image.
8. Stop the API — `docker compose stop api` — reload → "Couldn't load products." with **Retry**, and
   the header still navigates. `docker compose start api`, click **Retry** → the grid fills in with
   no page reload.
9. Narrow the window to a phone width → one column, no horizontal scrollbar, every card still tappable.
10. Empty state: with the products table cleared, the grid area shows "No products listed yet." and a
    **List the first product** button to the registration screen. Restore with
    `docker compose run --rm seed npm run db:seed -- --force`.

---

## LM-09 · Product Registration screen

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-06, LM-08
**Status:** Not started

> As a seller, I want a form to list a new product, so that I can put an item up for sale (§3.3).

**Acceptance criteria**

- [ ] Form has name, price, description and an image picker allowing multiple files.
- [ ] **Submit** creates the product in `Available` status and navigates to the Product List, where the new
      product is visible.
- [ ] **Cancel** returns to the Product List without saving anything.
- [ ] Selecting more than 5 images, or an image over 5MB, shows a visible error and blocks submission.
- [ ] **Name, price and description are all required** — each missing one shows a visible validation error rather
      than submitting.
- [ ] **Images are optional** — a product submitted with zero images is created successfully and lands on the
      Product List. The required/optional split is enforced server-side too, not only
      by the form.
- [ ] While the upload is in flight, submit cannot be double-clicked into creating two products.

**QA steps** — *browser*

1. Log in as Alice, click **Sell**.
2. Click **Submit** with all fields empty → visible validation errors on name, price **and** description; no navigation.
3. Fill name and price but leave **description** blank, click **Submit** → visible validation error, no product created
   (`psql $DB -c "select count(*) from products;"` unchanged).
4. Fill name `QA No Images`, price `30`, description `qa test`, attach **no** images, click **Submit** → succeeds,
   lands on Product List, card renders without a broken image.
5. Fill name `QA Lamp`, price `45`, description `qa test`, attach 2 images (use `mcp__claude-in-chrome__file_upload`),
   click **Submit** → lands on Product List, `QA Lamp` card is present with an image, price `45`, seller Alice, no status badge.
6. Click **Sell** again, fill the form, then click **Cancel** → back on Product List, no new card appears;
   confirm with `psql $DB -c "select count(*) from products;"` (unchanged from before Cancel).
7. Click **Sell**, attach 6 images → visible error, Submit blocked.
8. Click **Sell**, attach a >5MB file → visible error, Submit blocked.
9. Fill a valid form and double-click **Submit** quickly → `psql $DB -c "select count(*) from products where name='<that name>';"` → `1`.
10. Server-side enforcement of the same split:
    `curl -i -X POST http://localhost:3000/api/products -H "Authorization: Bearer $TOKEN_ALICE" -F 'name=No Desc' -F 'priceCents=1000'`
    → `400`; the same call with `-F 'description=ok'` and no image parts → `201`.

---

## LM-10 · Product Details screen

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-07, LM-08
**Status:** Not started

> As a logged-in user, I want to see everything about one listing on its own screen, so that I can decide whether
> to buy or negotiate (§3.4).

**Acceptance criteria**

- [ ] Shows name, status, initial price, description and **all** images.
- [ ] Plain text and plain `<img>` tags are acceptable — no gallery/carousel needed (§3.4).
- [ ] Reachable by clicking a card, and directly by URL while logged in.
- [ ] Seller's own product renders without buyer controls (the specific button rules land in LM-12 and LM-16).
- [ ] Unknown product id shows a not-found message, not a crash or blank screen.
- [ ] Refreshing the page re-fetches current state (refresh-driven updates are sufficient, §4.1).

**QA steps** — *browser*

1. Log in as Bob, click a product with multiple images → detail screen shows name, status, price, description and
   every image.
2. Copy the URL, reload → same content renders.
3. Log in as Alice (the seller) in an **incognito window**, open the same product → same core content renders,
   no buyer-only controls.
4. Edit the URL to an id that does not exist → not-found message, no crash and no blank white screen.
5. Change the product's status in SQL (`update products set status='Sold' …`), reload the page → status text updates.
   Restore afterwards.

---

## LM-11 · Purchase endpoint with atomic status transitions

**Priority:** P0 · **Estimate:** 2.5h · **Depends on:** LM-07
**Status:** Done · **QA:** passed 2026-08-15 — 44 checks covering all 7 steps, plus the malformed-id table and the
detail endpoint's viewer block. Step 7 run as ten parallel attempts by two buyers: one `200`, nine `409`, one buyer
recorded.
**Revised 2026-08-15:** each refusal now carries its own code — `OWN_PRODUCT`, `PRODUCT_NOT_AVAILABLE`,
`NEGOTIATION_OPEN` — instead of one shared `PURCHASE_NOT_ALLOWED`, so the UI can tell a buyer whether to settle
their negotiation or give up on the product. QA re-run: 47 checks.

> As a buyer, I want my purchase to either complete or be cleanly refused, so that a product can never be sold twice
> and I can never buy something I am not entitled to (§2.3).

**Acceptance criteria**

- [x] Buyer purchasing an `Available` product with no negotiation of their own → status becomes `Sold`.
- [x] The reserved buyer purchasing a `Reserved` product → status becomes `Sold`, at the **accepted** price;
      the endpoint takes no price input (§2.5 rule 8).
- [x] Blocked with a clear error: seller buying their own product; a non-reserved buyer buying a `Reserved`
      product; anyone buying a `Sold` product; a buyer with an open (not-yet-accepted) negotiation buying at the
      original price (§3.4).
- [x] The transition is a single guarded/conditional update keyed on current status (or a row lock) — not
      read-then-write (§2.3).
- [x] Two concurrent purchase attempts on the same `Available` product: exactly one succeeds, the other gets a
      conflict error. No path leaves the row in an inconsistent state.
- [x] All rules are enforced server-side, independent of whether the UI hid the button.
- [x] **Unit tests (§6):** direct-purchase happy path plus each blocked path — seller-buys-own,
      already-reserved-for-other, already-sold, negotiation-in-progress.

**QA steps** — *backend/curl + SQL*

1. Happy path: `curl -i -X POST http://localhost:3000/api/products/<alices_product>/purchase -H "Authorization: Bearer $TOKEN_BOB"`
   → `200`. Then `psql $DB -c "select status from products where id='<id>';"` → `Sold`.
2. Already sold: repeat the same call → `409`/`400`, status stays `Sold` in SQL.
3. Seller buys own: on a fresh `Available` product owned by Alice,
   `curl -i … -H "Authorization: Bearer $TOKEN_ALICE"` → error; SQL status still `Available`.
4. Reserved for someone else: use a seeded `Reserved` product (or set one up via LM-14 — a manual
   `update` must set `status`, `buyer_id` **and** `final_price_cents` together, since a check constraint ties them).
   Purchase as Carol → error; status unchanged. Then purchase as Bob → `200`, status `Sold`, and
   `final_price_cents` is the **accepted** amount, not `price_cents`.
5. Negotiation in progress: with Bob holding an open thread on a product (LM-13), purchase as Bob → error;
   status stays `Available`.
6. Unauthenticated purchase → `401`.
7. Concurrency smoke test on a fresh `Available` product:
   `for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/products/<id>/purchase -H "Authorization: Bearer $TOKEN_BOB" & done; wait`
   → exactly one `200`, the rest conflict codes; SQL shows a single `Sold` row. (Formalised in LM-18.)

---

## LM-12 · Purchase button behaviour in the UI

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-10, LM-11
**Status:** Not started

> As a buyer, I want a Purchase button that appears exactly when I am actually allowed to buy, so that I am never
> offered an action that will fail (§3.4).

**Acceptance criteria**

- [ ] Visible and enabled when the product is `Available` and the viewer is a buyer with no open negotiation on it.
- [ ] Visible and enabled when the product is `Reserved` **for this viewer**.
- [ ] Hidden for the seller, always.
- [ ] Hidden once the product is `Sold`, for everyone.
- [ ] Hidden for a buyer who has an open, not-yet-accepted negotiation on this product.
- [ ] Hidden for every buyer except the reserved one once the product is `Reserved`.
- [ ] **Stated rule, not an inference:** once the product is `Reserved` or `Sold`, **no control on this screen is
      actionable by anyone except the reserved buyer** — and for the reserved buyer the only remaining action is
      completing the purchase. This governs the whole detail screen, not just the Purchase
      button; the history controls in LM-16 follow the same rule.
- [ ] Clicking it sets the product to `Sold` and navigates back to the Product List, where the card now shows a
      `Sold` indicator.
- [ ] If the purchase is refused server-side (someone else bought first), the user sees an error and the screen
      reflects real current state after refresh — no silent failure.

**QA steps** — *browser, two users*

Use a normal window for **Alice (seller)** and an **incognito window** for **Bob (buyer)**.

1. Alice creates a product `QA Buy Me` (price 100). In her window, open its detail → **no Purchase button**.
2. In incognito, log in as Bob, open the same product → **Purchase button visible**.
3. Bob clicks **Purchase** → navigates back to Product List; the `QA Buy Me` card shows a `Sold` indicator.
4. Bob reopens the detail screen → **no Purchase button** (Sold).
5. In Alice's window, reload the Product List → card also shows `Sold`.
6. Reserved-for-me case: Alice lists `QA Reserve Me`; run a negotiation to acceptance with Bob (LM-13/LM-14), then:
   - Bob's detail screen → **Purchase button visible**.
   - Log Bob out in incognito, log in as **Carol**, open the same product → **no Purchase button**.
   - Alice's window → **no Purchase button**.
   - Bob logs back in and clicks **Purchase** → back on Product List, card shows `Sold`.
7. Negotiation-in-progress case: Alice lists `QA Negotiating`; Bob opens a counter offer on it (LM-16), then Bob's
   detail screen → **no Purchase button**. Carol, in her own session, still sees one (she has no thread yet).

---

## LM-13 · Negotiation engine — open thread and counter

**Priority:** P0 · **Estimate:** 2.5h · **Depends on:** LM-07
**Status:** Done · **QA:** passed 2026-08-15 — 43 checks. Both turn violations, seller self-offer, thread naming in
both directions, thread isolation with two unanswered seller counters live at once, terminal status, validation, and
five concurrent offers on one thread giving one `201` and four `409`.
**Revised 2026-08-15:** a counter now names the offer it answers (`inReplyToOfferId`) instead of the seller naming a
buyer, so a stale reference is refused as `OFFER_SUPERSEDED` rather than silently applied to the newest offer. QA
re-run: 37 checks.

> As a buyer or seller, I want to exchange counter offers in an orderly back-and-forth, so that we can converge on
> a price before the sale completes (§2.5).

**Acceptance criteria**

- [x] A buyer can open a thread on someone else's `Available` product with a first offer; the thread is scoped to
      that (product, buyer) pair and the first offer is always buyer-initiated (rule 1).
- [x] The seller can counter on a buyer's thread; the buyer can counter back. No cap on the number of exchanges.
- [x] Turn alternation is enforced: the side that just offered cannot offer again until the other side responds —
      rejected with a clear error (rule 2).
- [x] Only the **latest** offer in a thread is actionable; countering an earlier offer is rejected (rule 3).
- [x] Offers above **and** below the listed price are accepted, from either side (rule 4).
- [x] **There is no cap on how many of a seller's counters may be live at once**. The
      seller may counter in any number of buyers' threads and leave them all unanswered simultaneously. Do **not**
      implement a one-at-a-time restriction, a "finish this thread first" gate, or any per-seller lock — turn
      alternation is scoped to a single thread and never across threads.
- [x] A seller cannot open a thread on their own product; a buyer cannot open a second thread on the same product.
- [x] No new offers are accepted once the product is `Reserved` or `Sold` (rule 7).
- [x] Non-numeric, zero and negative prices are rejected.
- [x] Each offer persists timestamp, thread/buyer, `madeBy` and price.
- [x] **Unit tests (§6):** turn-alternation enforcement, only-latest-offer-actionable, multi-buyer thread isolation.

**QA steps** — *backend/curl + SQL*

1. Bob opens a thread on Alice's `Available` product:
   `curl -i -X POST http://localhost:3000/api/products/<id>/offers -H "Authorization: Bearer $TOKEN_BOB" -H 'Content-Type: application/json' -d '{"amountCents":8000}'`
   → `201`. `psql $DB -c "select made_by, price from offers where …;"` → one row, `made_by = buyer`.
2. Turn violation: Bob immediately posts another offer of `85` → **rejected** (`409`/`400`); SQL still shows one offer.
3. Alice counters `95`, naming the offer she is answering — `-d '{"amountCents":9500,"inReplyToOfferId":<bobs_offer_id>}'`
   → `201`; SQL shows two offers, second `made_by = seller`.
4. Turn violation the other way: Alice counters again → rejected; still two offers.
5. Bob counters `90`, naming Alice's counter → `201`, three offers.
6. Above-list offer: Bob's next legal turn posts a price above the listed price → accepted.
7. Seller self-offer: Alice tries to open a thread on her own product → rejected.
8. Duplicate thread: Bob posts again while it is Alice's turn → rejected. A *second* thread is not a state that
   exists — Bob's offers all share the same (product, buyer) pair (T-22), so this is the turn check, not a constraint.
9. Thread isolation: Carol opens her own thread on the same product with `70` → `201`;
   `psql $DB -c "select buyer_id, count(*) from offers where product_id='<id>' group by 1;"` → two distinct buyers.
   Confirm Carol's action did not change whose turn it is in Bob's thread.
10. Terminal state: `update products set status='Sold' where id='<id>';` then post any offer → rejected. Restore.
11. Validation: post `{"amountCents":-5}`, `{"amountCents":"abc"}`, `{"amountCents":0}` and `{"amountCents":10.5}` → all `400`.
12. Naming the offer answered: a counter with no `inReplyToOfferId` reads as opening a thread, so the seller gets
    `409 NEGOTIATION_NOT_ALLOWED` and a buyer who already has a thread gets the same. An `inReplyToOfferId` from
    another product → `404`. Countering an offer that is no longer the newest in its thread → `409 OFFER_SUPERSEDED`,
    **including when it is genuinely the caller's turn** — run `buyer → seller → buyer → seller`, then have the buyer
    answer the *first* seller counter rather than the second.
13. Concurrency: five simultaneous offers from Bob on a fresh thread → exactly one `201`, four `409`, one row in SQL.

---

## LM-14 · Accept an offer → Reserved

**Priority:** P0 · **Estimate:** 1.5h · **Depends on:** LM-13, LM-11
**Status:** Done · **QA:** passed 2026-08-15 — 56 checks. Both wrong-actor cases, the superseded-offer refusal in
both directions, the full Reserved lock-down sweep, completion at the accepted price, two live seller counters with
no cap, and five concurrent two-buyer races each giving exactly one `200`, one `409` and one recorded buyer.

> As the side being offered to, I want to accept the current offer, so that the product is locked to that buyer at
> the agreed price and nobody else can take it (§2.5 rule 5).

**Acceptance criteria**

- [x] Accepting the latest offer sets the product to `Reserved` with that thread's buyer as the reserved buyer.
- [x] The accepted price is recorded as the final purchase price and is what LM-11 charges.
- [x] That thread is closed/won; every other buyer's thread on the product is frozen — still readable, no longer
      actionable.
- [x] Only the side whose turn it is may accept (seller accepting a buyer-made latest offer, or the thread's buyer
      accepting a seller-made latest offer). Everyone else is rejected.
- [x] Accepting a non-latest offer is rejected.
- [x] Accept on an already `Reserved` or `Sold` product is rejected (rule 7).
- [x] **Stated rule, not an inference:** after this endpoint sets `Reserved`, the only action the API still permits
      on the product is the reserved buyer's purchase. Every other action — counter, accept, purchase — is rejected
      for every user including the seller.
- [x] **Multiple buyers may hold an actionable seller counter at the same time — first to act wins**
     . The seller may have unanswered counters live in any number of threads with no cap;
      each of those buyers sees a live Accept until one of them uses it.
- [x] The first Accept to land sets `Reserved` and freezes every other thread. **A later Accept from a losing
      buyer fails with a conflict error** — it must never succeed, never overwrite the reserved buyer, and never
      leave two threads marked won.
- [x] The losing buyer gets a clear "already reserved" style error, not a generic failure or a silent no-op.
- [x] The Available → Reserved transition is guarded/conditional on current status; two concurrent accepts on
      different threads cannot both succeed.
- [x] **Unit tests (§6):** accept → reserved, and other-buyer threads frozen after acceptance.

**QA steps** — *backend/curl + SQL*

1. Set up: Bob offers `8000`, Carol offers `7000` on the same Alice product (LM-13 steps 1 and 9).
2. Wrong actor: Carol tries to accept Bob's latest offer → rejected.
3. Wrong turn: Bob tries to accept his own latest offer → rejected.
4. `curl -i -X POST http://localhost:3000/api/offers/<bobs_latest_offer_id>/accept -H "Authorization: Bearer $TOKEN_ALICE"` → `200`.
5. `psql $DB -c "select status, buyer_id, final_price_cents, price_cents from products where id='<id>';"` →
   `Reserved`, Bob's id, `8000`, and the listed price unchanged. Accepting writes no offer row.
6. Frozen threads: Carol counters on her thread → rejected; Alice counters on Carol's thread → rejected.
7. Double accept: repeat step 4 → rejected, row unchanged.
8. Non-latest: accept an earlier offer id in Bob's thread → rejected.
9. Reserved lock-down sweep — with the product `Reserved` for Bob, confirm **every**
   non-Bob action is rejected: Carol purchase → rejected; Carol counter → rejected; Alice counter → rejected;
   Alice accept on Carol's thread → rejected; Alice purchase → rejected. Every negotiation refusal is
   `409 PRODUCT_NOT_AVAILABLE`. Then `psql $DB -c "select status, buyer_id, final_price_cents from products where
   id='<id>';"` → still `Reserved`, still Bob, still `8000`.
10. Completion price: Bob purchases (LM-11) → `200`; SQL shows `Sold` and the final price is `8000`, not the listed price.
11. **Multiple live seller counters — no cap**. On a fresh `Available` product listed by
    Alice at `10000`: Bob offers `8000`, Carol offers `7000`. Alice now counters **both** threads without either buyer
    responding in between — `POST …/products/<id>/offers` with `{"amountCents":9000,"inReplyToOfferId":<bobs_offer>}`,
    then the same naming Carol's offer at `8500`, both as `$TOKEN_ALICE` → **both `201`**. Neither is rejected for
    "another thread is awaiting a reply"; any such rejection is a defect. `psql $DB -c "select buyer_id, made_by,
    amount_cents from offers where product_id='<id>' order by id;"` → four rows, the two most recent both
    `made_by = seller` in different threads.
12. **Race — first Accept wins, deterministic version.** Both Bob and Carol are now sitting on an actionable seller
    counter. Accept as Bob → `200`. Immediately accept as Carol
    (`curl -i -X POST http://localhost:3000/api/offers/<carols_latest_offer_id>/accept -H "Authorization: Bearer $TOKEN_CAROL"`)
    → **conflict** (`409`), with an "already reserved" style message, not a generic 500 and not a silent `200`.
13. **Race — concurrent version.** Repeat the step-11 setup on a second fresh product, then fire both Accepts at once:
    ```
    curl -s -o /dev/null -w "bob:%{http_code}\n" -X POST http://localhost:3000/api/offers/<bobs_offer>/accept   -H "Authorization: Bearer $TOKEN_BOB" &
    curl -s -o /dev/null -w "carol:%{http_code}\n" -X POST http://localhost:3000/api/offers/<carols_offer>/accept -H "Authorization: Bearer $TOKEN_CAROL" &
    wait
    ```
    → exactly one `200` and one conflict code. Which one wins is not asserted; that **exactly one** wins is.
    Run this 5 times on 5 fresh products — every run must show one winner and one loser, never two winners.
14. **Winner recorded once.** After each race:
    `psql $DB -c "select status, buyer_id from products where id='<id>';"` → `Reserved`, with the buyer equal to
    whichever user got the `200` — never the loser, never null. There is no separate thread-status row to check:
    a thread is won because the product points at its buyer, so "two threads marked won" is not a state the
    schema can hold.
15. Completion after a contested race: the winning buyer purchases (LM-11) → `200`, `Sold` at their agreed price;
    the losing buyer's purchase attempt → rejected.

---

## LM-15 · Negotiation history read model

**Priority:** P0 · **Estimate:** 1h · **Depends on:** LM-13
**Status:** Done · QA: 2026-08-15, 46/46 checks (script covers all seven steps below); unit suite 53 passing.

> As any viewer of a product, I want the complete cross-buyer offer history in one chronological feed, so that the
> history section can render for everyone, not just my own thread (§2.5, §3.4).

**Revised 2026-08-15:** the feed is `GET /api/products/:id/offers`, not `/history` — the collection is
already exposed at that path by the counter endpoint (T-68). Each row carries a single `canRespond`
flag rather than separate Accept and Counter flags, since the two are one predicate (T-69).

**Acceptance criteria**

- [x] Returns every offer across **all** threads on the product, in chronological order.
- [x] Each row carries: timestamp, buyer display name, `madeBy`, price, and its thread.
- [x] Each row is flagged with whether it is the latest offer in its thread.
- [x] Each row carries whether the **requesting viewer** may Accept and/or Counter it, per the §3.4 rules
      (latest in thread **and** it is that viewer's turn).
- [x] Returned to the seller and to every buyer alike — not restricted to the thread owner.
- [x] Fetched in a small constant number of queries regardless of thread/offer count — no N+1 (§5).
- [x] Empty history returns an empty result, not an error.

**QA steps** — *backend/curl*

1. With Bob's and Carol's threads populated (LM-13):
   `curl -s http://localhost:3000/api/products/<id>/offers -H "Authorization: Bearer $TOKEN_ALICE" | jq` →
   all offers from both threads, ascending by timestamp, each with buyer name, `madeBy` and price.
2. Same call with `$TOKEN_BOB` → **same rows** (history is public to all viewers), but the actionable flags differ:
   Bob may act only on the latest seller-made offer in *his* thread, never on Carol's rows.
3. Same call with `$TOKEN_CAROL` → same rows, actionable flags scoped to Carol's thread only.
4. Cross-check the flags: exactly one row per thread is marked latest.
5. After LM-14 acceptance, re-run for all three tokens → no row is marked actionable for anyone.
6. Fresh product with no offers → `200` with an empty list.
7. N+1 check: tail DB logs while calling once → constant query count, not one per offer. Products with 2, 3 and
   5 offers all cost three statements (session lookup, product, offers joined to their buyers).

---

## LM-16 · Negotiation History UI with inline controls

**Priority:** P0 · **Estimate:** 3h · **Depends on:** LM-10, LM-14, LM-15
**Status:** Not started

> As a buyer or seller looking at a product, I want to see the whole offer history and act on the offer that is mine
> to answer, so that I can negotiate entirely from the product screen (§3.4).

**Acceptance criteria**

- [ ] An initial **Counter Offer** button is visible only to a buyer (never the seller) who has made no offer on
      this product yet; it disappears for that buyer once their thread exists.
- [ ] The Negotiation History section appears once at least one offer exists, and is visible to **everyone** —
      seller and all buyers.
- [ ] History renders as a chronological table/timeline across all buyers' threads; each row shows timestamp,
      buyer name, `madeBy` and price — exactly the four fields §3.4 lists.
- [ ] Inline **Accept** / **Counter Offer** controls appear on a row only when it is the latest offer in its thread
      **and** it is that viewer's turn (viewer is the seller and the row was buyer-made, or viewer owns the thread
      and the row was seller-made).
- [ ] Counter prompts for a new price; submitting logs the offer and returns to the Product List.
- [ ] Accept takes no price input; submitting sets the product to `Reserved` and returns to the Product List.
- [ ] **Once the product is `Reserved` or `Sold`, nothing on this screen is actionable by anyone except the
      reserved buyer's Purchase** — no Accept, no Counter, no initial Counter Offer button, for seller and every
      buyer alike. History stays fully readable.
- [ ] Server-side rejections (stale turn, product already reserved) surface as a visible error, not a silent no-op.

**QA steps** — *browser, three users*

Normal window = **Alice (seller)**. Incognito window = **Bob**. For Carol, log Bob out of the incognito window and
log in as Carol, then reverse when done (or open a second incognito profile if available).

1. Alice lists `QA Negotiate` at 100. Alice's own detail screen → **no** initial Counter Offer button, no history yet.
2. Incognito as Bob → detail screen shows **Counter Offer** button. Click it, enter `80`, submit → returns to
   Product List.
3. Bob reopens the product → initial Counter Offer button is **gone**; Negotiation History shows one row
   (timestamp, "Bob", buyer, 80). No Accept/Counter control on it for Bob (it is his own latest offer).
4. Alice's window, reload the product → history shows the same row, and it **does** carry Accept + Counter Offer
   controls for her.
5. Alice clicks **Counter Offer**, enters `95`, submits → returns to Product List. Reopen → two rows; the new
   seller row has no controls for Alice.
6. Bob reloads → two rows; the seller row (95) shows **Accept** and **Counter Offer** for Bob; the older row shows none.
7. Multi-buyer: in incognito log out of Bob, log in as **Carol**, open the product → she sees **both** of Bob's rows
   (history is public, and they are labelled "Bob") with **no** controls on them, plus her own initial
   **Counter Offer** button. She offers `70`.
8. Alice reloads → three rows chronologically, each naming its buyer; controls on Bob's latest buyer row and
   Carol's row, none on the seller row.
9. Alice clicks **Accept** on Bob's row → returns to Product List; `QA Negotiate` card shows a `Reserved` indicator.
10. Reserved lock-down — Alice reopens → history visible, **no** controls anywhere, no Counter.
    Carol (incognito) reopens → no controls on any row, **no** initial Counter Offer button, no Purchase button.
    Bob reopens → no Accept/Counter controls, but **Purchase** is available (LM-12). Nobody but Bob can act.
11. Sold lock-down — Bob purchases → reopen as each of the three users → history still readable, zero actionable
    controls for everyone including Bob.
12. Stale-turn error: with two windows both showing Alice's actionable row, accept in one, then click Accept in the
    other → visible error message, no second state change (`select status from products …` still `Reserved`).

---

# ─────────── MINIMUM SHIPPABLE CUT ───────────

**Everything above this line (LM-01 … LM-16), plus LM-17 (README) and LM-21 (submission), must be done for a
credible submission.** That set delivers every screen and rule in Part 1 of the spec, runnable by a reviewer from
a clean clone.

Below the line the work is hardening, documentation quality and bonuses — valuable and explicitly graded (§7, §8),
but each item is individually droppable without breaking the product.

---

# P1 — Required deliverables and hardening

## LM-17 · README with setup and seeded credentials

**Priority:** P1 · **Estimate:** 1.5h · **Depends on:** LM-16
**Status:** Not started

> As a reviewer, I want one document that gets me from clone to working app, so that I can evaluate the submission
> without asking questions (§7).

**Acceptance criteria**

- [ ] Lists prerequisites and versions (Docker, and anything else genuinely required).
- [ ] Gives the exact commands to start the stack, seed and reach the app.
- [ ] States all URLs and ports (web, API, DB, object storage console).
- [ ] Publishes the seeded test credentials from LM-03 verbatim, and explains that there is no registration by design (§2.1).
- [ ] States how to run the test suite.
- [ ] Explains that `.env` is committed on purpose so the stack runs straight from a clone with nothing to
      create by hand, that its values are local-only and not secrets, and that this exercise is not deployed
      anywhere — a real deployment would keep `.env` out of the repository and take its values from a secret store.
- [ ] Includes a short "try it in 5 minutes" walkthrough: log in as Bob → buy a product → log in as Carol →
      negotiate → accept → purchase.
- [ ] Documents known limitations and anything deliberately out of scope (§4.1, plus: no seller listing management,
      no losing-buyer notifications, no public deep links).
- [ ] **If LM-25 did not ship, the stuck-buyer limitation is stated explicitly** — a buyer who opens a negotiation
      loses the direct Purchase option and depends on the seller responding.
- [ ] **Verified against a clean clone** — the instructions are followed literally, start to finish, with no prior
      state on the machine.

**QA steps** — *backend + browser, clean-machine simulation*

1. `git clone <repo> /tmp/qa-clean && cd /tmp/qa-clean` — do **not** copy any `.env` or volumes across.
2. `docker compose down -v` in the original checkout first, so no shared volumes leak state.
3. Follow the README literally, command by command, in the clean clone. Any step that requires improvisation is a defect.
4. `curl -i http://localhost:3000/health` → `200`.
5. In Chrome, log in with the exact credentials as printed in the README → succeeds.
6. Run the documented test command → suite executes and passes.
7. Complete the 5-minute walkthrough exactly as written → each stated outcome is observed on screen.

---

## LM-18 · Concurrency and atomicity test suite

**Priority:** P1 · **Estimate:** 2h · **Depends on:** LM-11, LM-14
**Status:** Done · QA: 2026-08-16, 16/16 checks, five consecutive runs

> As an engineer, I want automated proof that concurrent purchase and accept attempts cannot both succeed, so that
> the atomicity requirement is demonstrated rather than asserted (§2.3, §6).

**Delivered as** `apps/api/test/smoke/api.smoke.test.ts`, run with `npm run test:smoke -w @linkby/api`
against a stack started by `docker compose up -d`. The suite is wider than this ticket: alongside the three
races it covers session handling, product creation and reading, a three-party negotiation, and every refusal
code. The unit run (`npm test`) stays separate and needs no stack.

**Acceptance criteria**

- [x] A test fires N concurrent purchase attempts at one `Available` product: exactly one succeeds, the rest fail
      with a conflict, final status is `Sold` exactly once.
- [x] A test fires concurrent accepts on two different threads of the same product: exactly one wins, the loser is
      rejected, exactly one reserved buyer is recorded. This is a **first-class scenario alongside the concurrent
      purchase test**, not an afterthought — simultaneous live seller counters are a
      normal, uncapped state, so this race is reachable in ordinary use rather than being an edge case.
- [x] The accept-race test asserts *exactly one* winner without asserting *which* buyer wins, so it does not depend
      on scheduling order and cannot flake.
- [x] A test covers concurrent purchase-vs-accept on the same product — the outcome is one of the two legal states,
      never a mixed/invalid one.
- [x] Tests run against a real Postgres (the guarantee under test is a database guarantee).
- [x] The suite is deterministic enough to run in CI or locally without flaking; the whole suite runs with one
      documented command.
- [x] Combined with LM-11 and LM-13, all three §6 areas are covered: direct purchase, counter-offer flow, atomicity.
- [x] Each test provisions its own product and an `afterAll` deletes this run's rows by id, so the suite re-runs
      without a reseed and leaves the seeded demo data untouched.

**QA steps** — *backend*

1. Run the documented test command → all tests pass; output names the purchase, counter-offer and atomicity groups.
2. Run it three times consecutively → passes every time (no flakes).
3. Manual corroboration of the same guarantee, in a shell:
   `for i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/products/<fresh_id>/purchase -H "Authorization: Bearer $TOKEN_BOB" & done; wait | sort | uniq -c`
   → exactly one `200`.
4. `psql $DB -c "select status, count(*) from products where id='<fresh_id>' group by 1;"` → single `Sold` row.
5. Accept-race corroboration: reproduce LM-14 QA steps 11–14 by hand once → one winner, one conflict, one reserved
   buyer. The suite's version of this must assert the same outcome.
6. Regression probe: temporarily neutralise a refusal guard, re-run the suite → the test covering that guard fails
   (proves it actually tests the guard). Restore the code afterwards. The purchase and accept guards are separate,
   so each is probed on its own: disabling the purchase guard fails the purchase-race test, disabling the accept
   guard fails the accept-race test.
7. Confirm the suite left nothing behind: `select count(*) from products;` and `select count(*) from offers;` →
   back to the seeded counts. One placeholder image per run stays in the bucket; `npm run db:seed -- --force`
   clears the prefix.

---

## LM-19 · Implementation plan, design decisions and deployment notes

**Priority:** P1 · **Estimate:** 2h · **Depends on:** LM-16
**Status:** Not started

> As a reviewer, I want to see the build order that was followed, the alternatives that were weighed, and what an
> AWS deployment would take, so that I can assess engineering judgement and not just the code (§7, §8).

**Acceptance criteria**

- [ ] Implementation plan doc states build order and milestones (schema → seed/Docker → auth → product CRUD →
      negotiation engine → history UI → bonuses) and notes where the actual build deviated and why.
- [ ] Design-decisions doc covers, at minimum: how atomic status transitions were implemented and what else was
      considered; the negotiation thread/offer model and rejected alternatives; auth/session approach and why it is
      stateless; image storage via S3-compatible storage and the S3 swap path.
- [ ] Each decision names at least one alternative considered and why it lost.
- [ ] Includes a short note that **buyer anonymity in the negotiation history was considered and rejected in favour
      of spec fidelity** — §3.4 names buyer as a row field, so the app follows it. The app has no deviations from
      the spec.
- [ ] Includes a short note that **hiding the final agreed price on `Sold` products was considered and rejected**:
      because the negotiation history stays public per §3.4, the amount is still readable from the last row of the
      winning thread, so concealing it elsewhere achieves nothing. Recorded so it is not re-proposed without also
      revisiting §3.4.
- [ ] A "with more time" section lists concrete optimisation and improvement ideas (§7).
- [ ] Scalability claims from §5 are addressed explicitly: statelessness, the indexes that exist and why, how the
      history view avoids N+1.
- [ ] Deployment notes describe what running this on AWS would require — container hosting, managed Postgres, real
      S3 in place of MinIO, secret/config handling, and what would have to change in code vs. config (§7).
- [ ] Honest about known gaps and shortcuts taken for the time budget.

**QA steps** — *review*

1. Open each doc; confirm every bullet above is present and non-empty.
2. Spot-check truthfulness against the code: pick the atomicity claim and confirm the described guard actually
   exists; pick the index claim and confirm with `psql $DB -c "\di"`.
3. Confirm the S3-swap claim by checking that storage endpoint and credentials are environment-driven
   (`docker compose config | grep -i -E 's3|minio|endpoint'`) and no bucket/endpoint is hardcoded in source.
4. Confirm the implementation plan's milestone list can be matched to real commits in `git log --oneline`.

---

## LM-20 · Meaningful git history and repo hygiene

**Priority:** P1 · **Estimate:** 0.5h · **Depends on:** LM-19
**Status:** Not started

> As a reviewer, I want a commit history that shows the work progressing in milestones, so that I can see how the
> solution was built rather than receiving one opaque drop (§7).

**Acceptance criteria**

- [ ] Commits land at meaningful milestones — never a single giant commit.
- [ ] Commit messages describe the milestone, not the mechanics ("negotiation accept → reserved", not "wip").
- [ ] No secrets, `.env` files, `node_modules`, build output or images committed; `.gitignore` covers them.
- [ ] `requirements.md`, `CLAUDE.md`, README and the docs from LM-19 are all committed.
- [ ] Repo clones and builds from `main` with no untracked-but-required files.

**QA steps** — *backend/shell*

1. `git log --oneline` → multiple milestone commits mapping to the phases below.
2. `git log --stat | head -50` → no single commit contains the entire application.
3. `git ls-files | grep -E 'node_modules|\.env$|dist/|build/'` → returns nothing.
4. `git grep -i -E 'password123|secret_key|AKIA' -- ':!README.md' ':!docs/' ':!*seed*'` → no real secrets in source.
5. Clone fresh into a temp dir and run the README steps (re-uses LM-17 QA) → app comes up.

---

## LM-21 · Submission and access grant — **DO THIS LAST**

**Priority:** P1 · **Estimate:** 0.25h · **Depends on:** LM-17, LM-19, LM-20
**Status:** Not started

> As the candidate, I want the reviewers to be able to open the repository, so that the work is actually received
> (§7).

**Do not start this ticket until everything above the cut line is verified green.**

**Acceptance criteria**

- [ ] All work is pushed to `main` on a single GitHub repository.
- [ ] Either: repo is **private** and GitHub users `andrewchak` and `derik-linkby` are granted access;
      **or**: repo is **public** and the URL is emailed to `derik@linkby.com` to notify of submission.
- [ ] Whichever path is chosen, it is completed — access confirmed in the repo settings, or the email is sent.
- [ ] The final pushed state is the state that was QA'd, not a later untested commit.

**QA steps** — *backend/shell + manual*

1. `git status` → clean tree. `git log origin/main -1 --oneline` → matches local `HEAD`.
2. Private path: `gh api repos/<owner>/<repo>/collaborators --jq '.[].login'` → includes `andrewchak` and
   `derik-linkby`. Also `gh api repos/<owner>/<repo> --jq .private` → `true`.
3. Public path: `gh api repos/<owner>/<repo> --jq .private` → `false`; open the repo URL in an incognito window
   (logged out of GitHub) → the repo loads. Then confirm the notification email to `derik@linkby.com` was sent.
4. Final sanity: clone the pushed repo into a clean temp dir and run the README quickstart once more → app comes up.

---

# P2 — Bonuses — only if time remains

**No P2 ticket may be started while anything above the minimum shippable cut is red.**

**Pick-up order (value-ranked — take them in this order, finish one before starting the next):**

`LM-25` → `LM-26` → `LM-27` → `LM-23` → `LM-22` → `LM-24`

IDs are allocation order, not value order; tickets below are listed by ID for navigation. LM-25 leads because it
remedies a known functional gap rather than adding a convenience. **LM-28 is a retired ID** — proposed, scoped and
cut; it is intentionally absent and nothing is renumbered to fill the gap.

---

## LM-22 · Product List status filter and ordering

**Priority:** P2 · **Estimate:** 2h · **Depends on:** LM-08
**Status:** Not started

> As a shopper, I want to filter the product list by status and control its order, so that I can look at what is
> still buyable and see the freshest listings first.

**Acceptance criteria**

- [ ] Filter offers `Available` / `Reserved` / `Sold` and a way back to showing everything.
- [ ] Filtering happens server-side against the status index from LM-02, not by filtering a full client-side list.
- [ ] The selected filter is visible in the UI, and an empty result shows a message rather than a blank grid.
- [ ] Default view (no filter) shows the same set of products as LM-08.
- [ ] **List ordering** *(folded in here rather than tracked separately)*: the list has a defined,
      stable order — newest listing first by default — so the grid does not reshuffle between reloads.
- [ ] Ordering is applied server-side and survives filtering (a filtered grid is ordered by the same rule).
- [ ] Ordering does not introduce an unindexed sort on the hot list path (§5).

**QA steps** — *browser + curl*

1. `curl -s 'http://localhost:3000/api/products?status=Sold' -H "Authorization: Bearer $TOKEN_BOB" | jq 'map(.status) | unique'` → `["Sold"]`.
2. Log in as Bob, select the `Available` filter → only cards without status badges remain; count matches
   `psql $DB -c "select count(*) from products where status='Available';"`.
3. Select `Reserved`, then `Sold` → grid contents match the corresponding SQL counts.
4. Select a status with zero matches → empty-state message, not a blank page or spinner.
5. Clear the filter → full grid returns.
6. Ordering: note the first three card names, reload the page three times → the same three, in the same order.
7. Ordering rule: create a new product as Alice, return to the list → it appears **first**. Cross-check against
   `psql $DB -c "select name from products order by created_at desc limit 3;"` → same order as the grid.
8. Ordering survives filtering: apply the `Available` filter → the remaining cards are still newest-first.

---

## LM-23 · Seller price edit before any negotiation

**Priority:** P2 · **Estimate:** 1.5h · **Depends on:** LM-13
**Status:** Not started

> As a seller, I want to correct my listed price while the item is still untouched, so that a typo does not force
> me to relist (§4.2).

**Acceptance criteria**

- [ ] Editing is allowed only when the product is `Available` **and** zero offers exist across all buyers.
- [ ] Once any buyer has made any offer, the price is frozen — edit is rejected server-side and the control is
      hidden in the UI.
- [ ] Only the seller may edit; any other user is rejected.
- [ ] The new price is what a subsequent direct purchase charges.
- [ ] Validation matches creation (positive numeric).

**QA steps** — *browser + curl*

1. Alice lists `QA Edit Me` at 100. In her window, the detail screen shows an edit control; change to `120`, save
   → detail shows 120; `psql $DB -c "select price from products where name='QA Edit Me';"` → `120`.
2. Bob (incognito) opens a counter offer of `90` on it.
3. Alice reloads → the edit control is **gone**.
4. Server-side enforcement: `curl -i -X PATCH http://localhost:3000/api/products/<id> -H "Authorization: Bearer $TOKEN_ALICE" -H 'Content-Type: application/json' -d '{"price":150}'`
   → rejected; SQL price still `120`.
5. Wrong actor: same PATCH with `$TOKEN_BOB` on a fresh untouched product → rejected.
6. Wrong status: set a product to `Reserved` in SQL, attempt the PATCH → rejected.

---

## LM-24 · Remaining §4.2 bonuses (search, "my offers", mobile)

**Priority:** P2 · **Estimate:** 3h (≈1h each, pick individually) · **Depends on:** LM-08, LM-16
**Status:** Not started

> As a user, I want to search listings, see only products I have offers on, and use the app on my phone, so that
> the app is more usable at scale (§4.2).

**Treat as three independent sub-items — take them one at a time, in this order, and stop when time runs out.**

**Acceptance criteria**

- [ ] *Search:* a query box filters the product list by name server-side; empty query restores the full list;
      no-match shows an empty-state message.
- [ ] *"My offers" filter:* shows only products where the current user owns a negotiation thread; correct for a
      user with zero threads (empty state).
- [ ] *Mobile responsiveness:* Product List, Detail and Registration remain usable and non-overlapping at a
      375px-wide viewport; the negotiation history table stays readable (scrollable rather than clipped).
- [ ] No bonus regresses any P0 behaviour — the LM-12 and LM-16 QA scripts still pass afterwards.

**QA steps** — *browser*

1. Search: log in as Bob, type a substring of a known product name → grid narrows to matching cards; confirm the
   request hits the API with a query parameter (DevTools Network tab), not a client-side array filter.
2. Search with gibberish → empty-state message. Clear the box → full grid returns.
3. My offers: as Bob (who owns a thread from LM-16 QA), enable the filter → only products with Bob's threads show.
   Log in as a user with no threads → empty state, no error.
4. Mobile: resize the viewport to 375×812 (`mcp__chrome-devtools__resize_page`) and walk Product List → Detail →
   Sell form → confirm nothing overlaps, all buttons are tappable, and the history table scrolls rather than clipping.
5. Regression: re-run the LM-12 purchase-visibility script and the LM-16 negotiation script end to end → both still pass.

---

## LM-25 · Purchase-at-original-price escape hatch for a negotiating buyer

**Priority:** P2 · **Estimate:** 2h · **Depends on:** LM-12, LM-15
**Status:** Not started

> As a buyer whose negotiation has stalled, I want to buy at the original listed price after all, so that opening a
> negotiation does not trap me with no way to complete the purchase.

*Accepted remedy for the known stuck-buyer limitation: per §3.4, opening a
negotiation removes the Purchase button, and a buyer whose seller never responds has no route to buying.*

**Acceptance criteria**

- [ ] A buyer with an open negotiation on an `Available` product regains a purchase option at the **original listed
      price** — not at any offered price.
- [ ] **Gate (the point of the ticket):** the option is available **only when the latest offer in that buyer's
      thread is strictly below the listed price**. If the latest offer is at or above the listed price, the option
      is absent. Without this gate a buyer could offer above list and then buy at list for less than they offered.
- [ ] The gate is re-evaluated against the *latest* offer each time, so it can appear and disappear as the thread
      progresses — including flipping off when the seller counters above list.
- [ ] Purchasing this way charges the listed price and moves the product `Available` → `Sold`, reusing the same
      guarded transition as LM-11 (no second, weaker purchase path).
- [ ] The buyer's thread is closed by the purchase; the product becomes non-actionable for everyone (LM-12 rule).
- [ ] Unavailable once the product is `Reserved` or `Sold`, and never available to the seller.
- [ ] Enforced server-side: a direct API call with the latest offer at or above list is rejected, even if the UI
      never showed the control.
- [ ] Clearly labelled in the UI as buying at the original price, so it cannot be mistaken for accepting an offer.
- [ ] Unit tests cover both sides of the gate (latest offer below list → allowed; at or above list → blocked).

**QA steps** — *browser, two users*

Normal window = **Alice (seller)**. Incognito = **Bob**.

1. Alice lists `QA Escape` at **100**.
2. Bob opens a counter offer of **80** (below list) → returns to Product List.
3. Bob reopens the product → the escape-hatch purchase option **is visible**, labelled as buying at the original
   price **100** (not 80). The standard Purchase button remains absent per §3.4.
4. **Gate proof — above list.** Alice lists `QA Escape High` at **100**; Bob offers **120**. Bob reopens the
   product → **no purchase option of any kind is present on the screen.** This is the critical assertion; capture
   the full page text (`mcp__claude-in-chrome__get_page_text`) to confirm no purchase control exists.
5. **Gate proof — exactly at list.** On a third product listed at 100, Bob offers **100** → reopen → **no purchase
   option** (the gate is *strictly* below).
6. **Gate flips off.** Back on `QA Escape` (Bob at 80): Alice counters **110**. Bob reloads → the escape hatch is
   now **gone**, because the latest offer is above list. Alice counters again at **90** on Bob's next turn cycle →
   Bob reloads → the option **returns**.
7. Happy path: on `QA Escape` with the latest offer below list, Bob clicks the option → returns to Product List,
   card shows `Sold`. `psql $DB -c "select status, final_price from products where name='QA Escape';"` → `Sold`
   at **100**, the listed price — *not* 80 or 90.
8. Server-side gate: on `QA Escape High` (latest offer 120),
   `curl -i -X POST http://localhost:3000/api/products/<id>/purchase-at-list -H "Authorization: Bearer $TOKEN_BOB"`
   → rejected; SQL status still `Available`.
9. Seller blocked: same call with `$TOKEN_ALICE` → rejected.
10. Terminal states: set a product `Reserved` for Carol, then call as Bob with a below-list latest offer → rejected.
11. Regression: re-run the LM-12 script → the standard Purchase button rules are unchanged for buyers with no thread.

---

## LM-26 · Confirmation step on Purchase and Accept

**Priority:** P2 · **Estimate:** 1h · **Depends on:** LM-12, LM-16
**Status:** Not started

> As a user about to do something irreversible, I want to confirm first, so that a misclick does not permanently
> sell or reserve a product.

*Both actions are terminal with no undo — Purchase is a one-way trip to `Sold`, Accept to
`Reserved`.*

**Acceptance criteria**

- [ ] Clicking **Purchase** asks for confirmation before anything is sent to the server.
- [ ] Clicking **Accept** asks for confirmation before anything is sent to the server.
- [ ] The confirmation states what is about to happen and at what price, so the user can catch a wrong-row click.
- [ ] Cancelling makes **no** state change — no request is sent, the user stays on the product screen, and the
      product's status is unchanged.
- [ ] Confirming proceeds exactly as before (same endpoint, same navigation).
- [ ] Implemented as an **in-page DOM dialog, never `window.confirm`/`alert`** — a native dialog hard-blocks the
      browser automation used for QA.
- [ ] Keyboard-dismissable (Escape cancels) and the confirm control is not the default-focused element, so a stray
      Enter does not confirm.
- [ ] If LM-27 also lands, the confirmation and the post-action feedback modal do not stack or fight each other.

**QA steps** — *browser, two users*

1. Alice lists `QA Confirm` at 50. Bob (incognito) opens it and clicks **Purchase** → a confirmation appears
   **in the page**, naming the product and the price 50.
2. Automation sanity check: after step 1, call `mcp__claude-in-chrome__read_page` → the page is readable and the
   dialog appears in the DOM. If the automation hangs or reports a blocking native dialog, the ticket **fails**.
3. Click **Cancel** → dialog closes, still on the product screen.
   `psql $DB -c "select status from products where name='QA Confirm';"` → still `Available`.
4. Confirm the network tab shows **no** purchase request was sent during step 3.
5. Click **Purchase** again, press **Escape** → dialog closes, status still `Available`.
6. Click **Purchase**, then confirm → navigates to Product List, card shows `Sold`; SQL confirms `Sold`.
7. Accept path: set up a negotiation (LM-16 QA steps 1–5). Alice clicks **Accept** on a row → in-page confirmation
   naming the price. Cancel → `select status …` still `Available`, no request sent. Repeat and confirm →
   status `Reserved`.
8. Wrong-row protection: with two actionable rows at different prices, click Accept on each in turn and read the
   dialog text → the price shown matches the row clicked.

---

## LM-27 · Post-action feedback modal

**Priority:** P2 · **Estimate:** 1.5h · **Depends on:** LM-12, LM-16
**Status:** Not started

> As a user who just purchased, accepted or countered, I want a clear acknowledgement of what happened, so that I
> am not silently teleported back to the product list wondering whether it worked.

*Replaces the silent navigation specified in §3.4.*

**Acceptance criteria**

- [ ] After Purchase, Accept and Counter, a modal reports what happened (and the resulting price/status where
      relevant) instead of the screen silently navigating away.
- [ ] The modal sits over a **semi-transparent backdrop that blocks interaction** with the page beneath.
- [ ] The modal contains a **navigate-to-list** button; using it is what returns the user to the Product List.
- [ ] The underlying action has already succeeded before the modal appears — the modal reports, it does not confirm
      (confirmation is LM-26's job, and runs *before* the action).
- [ ] A failed action shows an error state rather than a success message.
- [ ] Implemented as an **in-page DOM modal, never `window.alert`** — a native dialog hard-blocks the browser
      automation used for QA.
- [ ] Dismissable by keyboard (Escape) and focus is moved into the modal when it opens.
- [ ] Does not double-fire: completing one action produces exactly one modal.

**QA steps** — *browser, two users*

1. Alice lists `QA Modal` at 60. Bob (incognito) purchases it → a modal appears **over** the product screen
   confirming the purchase; the page does **not** navigate on its own.
2. Automation sanity check: call `mcp__claude-in-chrome__read_page` while the modal is open → returns page content
   normally. A hang or a reported native dialog is a **fail**.
3. Backdrop check: attempt to click a control behind the backdrop (e.g. the header **Sell** link) → the click does
   not reach it; the modal stays open and no navigation occurs.
4. Click the modal's navigate-to-list button → lands on Product List; `QA Modal` card shows `Sold`.
5. Screenshot the modal (`mcp__chrome-devtools__take_screenshot`) → backdrop is visibly semi-transparent, with the
   page still discernible behind it.
6. Counter path: Bob counters on another product → modal reports the offer was logged, with the price; navigate-to-list
   button returns to the grid; `psql $DB -c "select count(*) from offers where …;"` → exactly one new offer (no
   double-fire).
7. Accept path: Alice accepts → modal reports the reservation and the agreed price; SQL shows `Reserved`.
8. Escape key closes the modal; the completed action remains committed in SQL (the modal is informational only).
9. Error path: with two windows on the same actionable row, accept in one and then in the other → the second shows
   an **error** state, not a success message.

---

*(LM-28 was proposed and cut. The ID is retired and deliberately left unused; the remaining tickets are **not**
renumbered, so every cross-reference in this doc stays valid.)*

