# Linkby Marketplace — Wireframes & UX Flow

Scope: every UI page/state in requirements.md §3, plus the error/empty/loading states that are
genuinely required. Desktop-first. Implementation-agnostic — no framework, component library, or
styling system is assumed or implied by anything here. Boxes are layout intent, not pixel specs;
per §8 the UI does not need to be beautiful, so these favor state coverage over polish.

Terminology used throughout:

- **Seller** — the viewer owns the product (`product.sellerId == viewer.id`).
- **Buyer** — any signed-in viewer who is not the seller.
- **Own thread** — the negotiation thread for `(this product, this viewer-as-buyer)`.
- **Open thread** — a thread with ≥1 offer that has not been accepted.
- **Reserved buyer** — the buyer whose thread was accepted (product status `Reserved`).
- **Awaiting me** — the latest offer in a thread was made by the other side (§2.5 rule 2).

> **Decision log:** §10 records which of these choices are **DECIDED** (ruled on by the product
> owner) and which are explicit **NON-GOALS**. **Every item is now settled — nothing is open.** Items
> deferred to bonus scope are described in §9 and are deliberately *not* drawn into the core
> wireframes. Two rulings are stated as named rules for the implementer: **R1** (terminal
> exclusivity, §4.1) and **R2** (concurrent threads, §5.2).

---

## 1. Login (§3.1)

```
+==============================================================================+
|                                                                              |
|                                                                              |
|                       Linkby Marketplace                                     |
|                                                                              |
|              +----------------------------------------------+                |
|              |                                              |                |
|              |  Email                                       |                |
|              |  [ alice@example.com....................]    |                |
|              |                                              |                |
|              |  Password                                    |                |
|              |  [ ......................................]   |                |
|              |                                              |                |
|              |                        [    Login    ]       |                |
|              |                                              |                |
|              +----------------------------------------------+                |
|                                                                              |
|         Seeded test accounts only — there is no registration.                |
|                                                                              |
+==============================================================================+
```

**Purpose:** authenticate a seeded user and drop them on the Product List.

**Elements**

| Element | Behaviour | Navigates to |
| --- | --- | --- |
| Email input | Free text, required | — |
| Password input | Masked, required | — |
| Login button | Submits credentials | Product List on success; stays on Login on failure |
| Helper line | Static text reminding reviewers there is no sign-up | — |

**Visibility / enablement**

- Login is disabled while either field is empty, and while a submit is in flight.
- No "forgot password", no "register" link — §2.1 / §4.1 exclude both.

### 1a. Login — invalid credentials

```
+----------------------------------------------+
|  (!) Email or password is incorrect.         |
|                                              |
|  Email                                       |
|  [ alice@example.com....................]    |
|                                              |
|  Password                                    |
|  [ ......................................]   |
|                                              |
|                        [    Login    ]       |
+----------------------------------------------+
```

- One generic message for both wrong-email and wrong-password (no account enumeration).
- Password field is cleared; email is preserved.

### 1b. Login — submitting

- Button label swaps to `Logging in…` and is disabled; both inputs are read-only.

---

## 2. Product List — landing page (§3.2)

```
+==============================================================================+
| Linkby Marketplace                    [ Sell ]  [ Logout ]   alice@example.com|
+==============================================================================+
|                                                                              |
|  <-- bonus slot: status filter / search / "my offers" (see §9) -->           |
|                                                                              |
|  +--------------------+  +--------------------+  +--------------------+      |
|  |  +--------------+  |  |  +--------------+  |  |  +--------------+  |      |
|  |  |   [image]    |  |  |  | (no image)   |  |  |  |   [image]    |  |      |
|  |  +--------------+  |  |  +--------------+  |  |  +--------------+  |      |
|  |  Vintage Camera    |  |  Desk Lamp         |  |  Road Bike         |      |
|  |  $250.00           |  |  $40.00            |  |  $900.00           |      |
|  |  Seller: alice     |  |  Seller: bob       |  |  Seller: carol     |      |
|  | [YOURS][AVAILABLE] |  |        [RESERVED]  |  |          [ SOLD ]  |      |
|  +--------------------+  +--------------------+  +--------------------+      |
|                                                                              |
|  +--------------------+  +--------------------+                              |
|  |  +--------------+  |  |  +--------------+  |                              |
|  |  |   [image]    |  |  |  |   [image]    |  |                              |
|  |  +--------------+  |  |  +--------------+  |                              |
|  |  Oak Table         |  |  Guitar            |                              |
|  |  $310.00           |  |  $180.00           |                              |
|  |  Seller: alice     |  |  Seller: dan       |                              |
|  |        [AVAILABLE] |  |        [AVAILABLE] |                              |
|  +--------------------+  +--------------------+                              |
|                                                                              |
+==============================================================================+
```

**Purpose:** browse every listing and enter any one of them.

**Elements**

| Element | Behaviour | Navigates to |
| --- | --- | --- |
| `Sell` (header) | Start a new listing | Product Registration |
| `Logout` (header) | Clears session | Login |
| Signed-in email (header) | Static label, identifies the acting user (matters a lot here — role is per-product) | — |
| Product card (whole card clickable) | Opens the listing | Product Details |
| Card image | First uploaded image; a parcel icon on a neutral block if the product has none | — |
| Card name / price / seller | Static. Price is the **listed** price, never the negotiated one. The name is one line, ellipsed when it overflows, with the full text on hover | — |
| Card status badge (bottom-right) | Text badge | — |
| `Your listing` badge | A shop icon and the words, left of the status badge, only on products the viewer sells | — |
| `Reserved for you` badge | Same position, on a `Reserved` product whose buyer is the viewer | — |

**Visibility / enablement**

- Status badge is rendered on every card, including `Available`, so the state is always stated
  outright rather than inferred from an absence. Weight tracks how settled the state is: an outlined
  badge for `Available`, a filled grey one for `Reserved`, a solid one for `Sold`.
- A card for a product the viewer sells carries a `Your listing` badge beside its status, so a seller
  can pick their own listings out of the grid without opening them. Nothing else about the card
  changes; role still only affects what can be done on Details.
- No pagination (§3.2). Ordering is not a core concern — it folds into the status-filter bonus
  (A9, deferred; §9.1). `Sold` and `Reserved` cards are neither hidden nor sunk to the bottom.

### 2a. Product List — empty

```
+==============================================================================+
| Linkby Marketplace                    [ Sell ]  [ Logout ]   alice@example.com|
+==============================================================================+
|                                                                              |
|                 +------------------------------------------+                 |
|                 |   No products listed yet.                |                 |
|                 |                                          |                 |
|                 |   [ List the first product ]             |                 |
|                 +------------------------------------------+                 |
|                                                                              |
+==============================================================================+
```

- Shown when the collection is empty. CTA goes to Product Registration.
- Distinct from the loading state — never show "empty" before the fetch resolves.

### 2b. Product List — loading

- Grid area shows 6 neutral placeholder cards (or the single line `Loading products…`); header is
  fully interactive throughout.

### 2c. Product List — fetch failure

```
|   (!) Couldn't load products.   [ Retry ]                                    |
```

### 2d. Post-action feedback (DECIDED)

**Purchase** confirms with the modal drawn in §9.4 and navigates here only when the user
acknowledges it. Purchase is the one action that completes a sale and takes money, and it completes
fast enough that a plain navigation reads as nothing having happened.

**Accept, Counter submit and Registration submit** land back on this page as a **plain navigation
with no confirmation message** — no banner, no toast, no interstitial. The grid simply re-renders
with the product's new state, and the only evidence the action succeeded is the changed status badge
(or, for a new listing, the new card). Their modal variants stay in bonus scope.

---

## 3. Product Registration (§3.3)

```
+==============================================================================+
| Linkby Marketplace                    [ Sell ]  [ Logout ]   alice@example.com|
+==============================================================================+
|                                                                              |
|  New listing                                                                 |
|  ----------------------------------------------------------------           |
|                                                                              |
|  Name                                                                        |
|  [ Vintage Camera.......................................................]    |
|                                                                              |
|  Price                                                                       |
|  $ [ 250.00 ..........]                                                      |
|                                                                              |
|  Description                                                                 |
|  [ 1970s rangefinder, fully serviced......................................]  |
|  [ .......................................................................]  |
|  [ .......................................................................]  |
|                                                                              |
|  Images (up to 5, max 5MB each)                                              |
|  [ Choose files ]                                                            |
|                                                                              |
|   +---------+  +---------+  +---------+                                      |
|   | [thumb] |  | [thumb] |  | [thumb] |     2 slots remaining                |
|   |   (x)   |  |   (x)   |  |   (x)   |                                      |
|   +---------+  +---------+  +---------+                                      |
|                                                                              |
|                                        [ Cancel ]   [   Submit   ]           |
|                                                                              |
+==============================================================================+
```

**Purpose:** create a listing in `Available` status.

**Elements**

| Element | Behaviour | Navigates to |
| --- | --- | --- |
| Name | Required text, max 120 characters | — |
| Price | Required, positive number, currency-prefixed | — |
| Description | Required multi-line text (A10, decided), max 2000 characters | — |
| Character counter | `used/limit` under Name and Description, always visible | — |
| `Choose files` | Adds image files to the pending set | — |
| Thumbnail `(x)` | Removes that image from the pending set before submit | — |
| Slots-remaining counter | `5 - selected` ; the file picker is disabled at 0 | — |
| `Submit` | Creates the product as `Available` | Product List (plain navigation, no confirmation — §2d) |
| `Cancel` | Discards everything, saves nothing (§3.3) | Product List |

**Visibility / enablement**

- `Submit` disabled while: any required field is empty, price is non-numeric or ≤ 0, any selected
  file fails validation, or a submit is already in flight.
- An empty field carries no message — it explains itself. A price that is filled in but cannot be
  parsed does carry one, since a dead button beside a filled field has no visible cause.
- `Choose files` disabled once 5 images are selected.
- Images are optional — a product with zero images is valid (§3.2 says "first image *if any*").
- The price field exists **only** here. There is no edit-price control anywhere in core scope (§2.4).

### 3a. Registration — upload validation failure

```
|  Images (up to 5, max 5MB each)                                              |
|  [ Choose files ]                                                            |
|                                                                              |
|  (!) "beach-raw.png" is 12.4MB — the limit is 5MB per image. Not added.      |
|  (!) Only 5 images allowed — "extra.jpg" was not added.                      |
|                                                                              |
|   +---------+  +---------+                                                   |
|   | [thumb] |  | [thumb] |          3 slots remaining                        |
|   |   (x)   |  |   (x)   |                                                   |
|   +---------+  +---------+                                                   |
```

- Rejection happens at selection time, not at submit — valid files in the same batch are still added,
  rejected ones are named individually.
- Rejection reasons: over 5MB, over the 5-image cap, unsupported file type — JPEG/PNG/WebP only
  (A11, decided).
- The form stays fully usable; nothing is cleared.

### 3b. Registration — submit failure

```
|  (!) Couldn't create the listing. Nothing was saved.                         |
```

- Fields and selected images are all preserved so the user can retry without re-picking files.
- The message sits above the fields; `Submit` is the retry, so there is no separate `Try again`
  button next to it.

### 3c. Registration — submitting

- `Submit` → `Submitting…`, disabled; `Cancel` disabled too (avoids abandoning a half-written upload).

---

## 4. Product Details (§3.4)

### 4.1 Base layout

```
+==============================================================================+
| Linkby Marketplace                    [ Sell ]  [ Logout ]   alice@example.com|
+==============================================================================+
|  < Back to products                                                          |
|                                                  +-------------------------+ |
|  (shop) This is your listing.   (own product)    |                         | |
|                                                  |                         | |
|  Vintage Camera               Status: AVAILABLE  |  ACTION PANEL           | |
|  Listed price: $250.00                           |  (varies — see 4.3)     | |
|  Seller: bob                                     |  [ Purchase — $250.00 ] | |
|                                                  |  [ Counter Offer      ] | |
|  1970s rangefinder, fully serviced. Light meter  +-------------------------+ |
|  works. Minor brassing on the top plate.         |  NEGOTIATION HISTORY    | |
|                                                  |  (only when ≥1 offer    | |
|  +---------+ +---------+ +---------+             |   exists — see §5)      | |
|  | [img 1] | | [img 2] | | [img 3] |             |                         | |
|  +---------+ +---------+ +---------+             +-------------------------+ |
+==============================================================================+
```

**Purpose:** show one listing in full and expose exactly the actions this viewer is allowed to take
on it right now.

**Layout.** Two columns from `lg` up: the listing itself on the left, and a right-hand panel holding
every actionable control — the action buttons, and the negotiation history with its inline controls
beneath them. The panel is sticky, so no action is ever hidden below the scroll. Below `lg` the panel
wraps underneath the listing, full width, and the page reads as one column.

The panel renders only when it would hold something. When a viewer has no actions and there is no
history — a seller looking at an untouched listing, or anyone looking at a sold one — the listing
takes the full width instead of sitting beside an empty column.

**Always-present elements**

| Element | Behaviour | Navigates to |
| --- | --- | --- |
| `< Back to products` | Plain back link | Product List |
| Name / status / listed price / description | Static display (§3.4) | — |
| Seller line | Always the seller's name | — |
| `This is your listing.` banner | Above the title, only when the viewer sells this product. Carries the same shop icon as the card's badge | — |
| `This product is reserved for you.` banner | Above the title when the viewer is the reserved buyer, telling them they can now proceed to purchase | — |
| `This product is no longer available.` banner | Above the title when the product is `Reserved` or `Sold`, except for the seller and except for the reserved buyer | — |
| Images | Every image, three to a row (two below `sm`), each whole and uncropped | — |
| An image | Clicking it opens that image's original, full size | New browser tab |

When a product has no images, the grid is replaced by a muted placeholder box carrying the same
package icon the card uses.

**Conditional elements:** `Purchase`, initial `Counter Offer`, the Negotiation History section, and a
context banner. All governed by the tables in 4.4–4.6.

> **Rule R1 — terminal exclusivity (DECIDED, A1).** Once a product is `Reserved` or `Sold`, it is no
> longer actionable by anyone other than the reserved buyer. The reserved buyer's only remaining
> action is `Purchase`; once `Sold`, no one has any action at all. This is a **requirement in its own
> right**, not a derivation from §2.5 r7 — it is the single gate behind the hidden cases in §4.4,
> §4.5, and Gate 1 of §5.5, and it holds regardless of whether a viewer has an existing thread.

### 4.2 Context banner (status-dependent, above the action bar)

| Condition | Banner text |
| --- | --- |
| Viewer is the seller | `This is your listing.` — regardless of status |
| `Available`, no offers at all | *(none)* |
| `Available`, viewer's own thread awaits the seller | `Your offer of $220.00 is awaiting the seller's response.` |
| `Available`, viewer is seller, ≥1 thread awaits them | `2 offers are waiting on your response.` |
| `Reserved`, viewer is the reserved buyer | `This product is reserved for you.` / `You can now proceed to purchase.` |
| `Reserved`, viewer is any other buyer | `This product is no longer available.` |
| `Sold`, viewer is not the seller | `This product is no longer available.` |

The accepted price is not repeated in a banner: the reserved buyer's Purchase button already names the
amount it will charge, and the status badge names the status. The "Listed price" line never changes
(§2.4).

The offer-dependent rows — the two `Available` ones, and naming the winning buyer to the seller —
arrive with the negotiation history, which is where the offers and the buyer's name come from.

### 4.3 Enumerated states

Ten distinct Product Details states. Each is (viewer role × product status × this viewer's thread
position). "History" = whether the Negotiation History section renders.

**Seller-side**

| # | Condition | Action bar | History |
| --- | --- | --- | --- |
| **PD-S1** | Seller, `Available`, zero offers on the product | *(empty — no buttons at all)* | Hidden |
| **PD-S2** | Seller, `Available`, ≥1 thread whose latest offer was made by a buyer | *(empty — controls are inline in history)* | Shown, with inline `Accept` / `Counter Offer` on each awaiting-seller row |
| **PD-S3** | Seller, `Available`, offers exist but every thread's latest offer is the seller's | *(empty)* — the seller has **no available action anywhere on this product** until a buyer responds; expected, not a bug (rule **R2**, §5.2) | Shown, fully read-only |
| **PD-S4** | Seller, `Reserved` | *(empty)* | Shown, frozen/read-only |
| **PD-S5** | Seller, `Sold` | *(empty)* | Shown, frozen/read-only |

A seller never sees `Purchase` or `Counter Offer` in the action bar — §2.1 forbids acting on your own
product, and §2.5 rule 1 makes every thread buyer-initiated.

**Buyer-side**

| # | Condition | Action bar | History |
| --- | --- | --- | --- |
| **PD-B1** | Buyer, `Available`, viewer has no thread, product has zero offers | `[ Purchase ]  [ Counter Offer ]` | Hidden |
| **PD-B2** | Buyer, `Available`, viewer has no thread, other buyers have offers | `[ Purchase ]  [ Counter Offer ]` | Shown, read-only (other buyers' rows are never actionable by this viewer) |
| **PD-B3** | Buyer, `Available`, own thread open, latest offer is the viewer's | *(empty)* + "awaiting seller" banner | Shown; own latest row is **not** actionable |
| **PD-B4** | Buyer, `Available`, own thread open, latest offer is the seller's | *(empty)* | Shown; own latest row carries inline `Accept` / `Counter Offer` |
| **PD-B5** | Buyer, `Reserved` **for this viewer** | `[ Purchase ]` (at the accepted price) | Shown, frozen |
| **PD-B6** | Buyer, `Reserved` for someone else (viewer may or may not have a losing thread) | *(empty)* | Shown, frozen |
| **PD-B7** | Buyer, `Sold` | *(empty)* | Shown, frozen |

**PD-B1 / PD-B2 wireframe (both buttons live):**

```
|  Vintage Camera                                     Status: AVAILABLE        |
|  Listed price: $250.00        Seller: bob                                    |
|  ...                                                                         |
|  [  Purchase  ]   [  Counter Offer  ]                                        |
```

**PD-B5 wireframe (reserved for this buyer):**

```
|  Vintage Camera                                     Status: RESERVED         |
|  Listed price: $250.00        Seller: bob                                    |
|  (i) Reserved for you at $220.00. Complete the purchase below.               |
|  ...                                                                         |
|  [  Purchase — $220.00  ]                                                    |
```

Purchase does **not** re-prompt for a price (§2.5 rule 8); the button states the price it will charge.

**PD-B3 wireframe (waiting on the seller — the "no controls anywhere" state):**

```
|  Vintage Camera                                     Status: AVAILABLE        |
|  Listed price: $250.00        Seller: bob                                    |
|  (i) Your offer of $220.00 is awaiting the seller's response.                |
|  ...                                                                         |
|  (no action buttons)                                                         |
|  --- Negotiation history ---   (your latest row shows no controls)           |
```

This state is easy to mistake for a bug, which is why the banner exists — otherwise a buyer who has
opened a negotiation sees a page with no affordances and no explanation of why Purchase vanished.

### 4.4 Truth table — `Purchase` button

Source: §3.4 "Purchase button". `—` = irrelevant to the outcome.

| # | Viewer | Status | Viewer has own thread | Viewer is reserved buyer | Purchase |
| --- | --- | --- | --- | --- | --- |
| 1 | Seller | `Available` | — | — | **Hidden** (§2.1 — never buy your own) |
| 2 | Seller | `Reserved` | — | — | **Hidden** |
| 3 | Seller | `Sold` | — | — | **Hidden** |
| 4 | Buyer | `Available` | No | n/a | **Visible + enabled** — charges the listed price |
| 5 | Buyer | `Available` | Yes (open) | n/a | **Hidden** — negotiating forfeits direct purchase |
| 6 | Buyer | `Reserved` | Yes (accepted) | Yes | **Visible + enabled** — charges the accepted price |
| 7 | Buyer | `Reserved` | Yes (open, now frozen) | No | **Hidden** |
| 8 | Buyer | `Reserved` | No | No | **Hidden** |
| 9 | Buyer | `Sold` | — | — | **Hidden** |

Rows 4 and 6 are the only visible cases. Note there is no "visible but disabled" case — the button is
either offered or absent, which keeps the rule readable and avoids a disabled control the user cannot
explain.

`Reserved` + "viewer is reserved buyer" implies the viewer has a thread (reservation only arises from
an accept), so no additional row is needed for reserved-without-thread.

Rows 7–9 are all rule **R1**: `Reserved`/`Sold` locks everyone out except the reserved buyer.

**Action result:** sets status to `Sold`, then navigates to **Product List** (plain navigation, no
confirmation in core — §2d). One click, no confirmation step (A2, decided; the confirm step is
bonus, §9.3).

### 4.5 Truth table — initial `Counter Offer` button (action bar)

Source: §3.4 "Counter Offer button (initial)", constrained by §2.5 rule 1 and by rule **R1**.

| # | Viewer | Status | Viewer has ever made an offer here | Initial Counter Offer |
| --- | --- | --- | --- | --- |
| 1 | Seller | — | — | **Hidden** (threads are always buyer-initiated, §2.5 r1) |
| 2 | Buyer | `Available` | No | **Visible + enabled** |
| 3 | Buyer | `Available` | Yes | **Hidden** — subsequent controls live inline in history |
| 4 | Buyer | `Reserved` | No | **Hidden** (rule R1) |
| 5 | Buyer | `Reserved` | Yes | **Hidden** |
| 6 | Buyer | `Sold` | — | **Hidden** |

Row 2 is the only visible case. Note the asymmetry worth remembering during build: `Purchase`
disappears the moment a buyer opens a negotiation, while the initial `Counter Offer` disappears for
the same reason — after the first offer, a buyer's *only* controls are the inline ones on their own
latest row, and only when it is their turn.

**Action result:** opens the price-entry panel (§6); submitting logs offer #1 of a new thread and
navigates to **Product List**.

### 4.6 Product Details — error / loading states

| State | Presentation |
| --- | --- |
| Loading | `Loading product…` in the content area; header interactive |
| Not found / deleted / malformed id in the URL | `That product doesn't exist.  [ Back to products ]` — a malformed id shows this without asking the server |
| Fetch failure | `(!) Couldn't load this product.  [ Retry ]` |
| Stale action conflict | See §7 |
| Action in flight | The clicked button shows `Working…` and **all** action controls on the page disable together — never let a second mutating click through |

---

## 5. Negotiation History (§3.4, embedded in Product Details)

One chronological, cross-buyer list, visible to **everyone** who can see the product — seller and
every buyer, not just thread participants (§3.4).

It lives inside the right-hand action panel (§4.1), beneath the action buttons, so every control a
viewer can use sits in one column. The sketches below are drawn as a wide table to show the columns
and the per-row rules; how a row is laid out in a narrow panel is settled when the history is built.

### 5.1 Row spec (DECIDED, A4)

Rows follow requirements.md §3.4 exactly: **timestamp, buyer name, `madeBy`, price**, plus an Actions
cell for the inline controls.

| Column | Content |
| --- | --- |
| Timestamp | Offer time, ascending across all threads |
| Buyer | The **real user name** of the buyer who owns that thread — the same name everyone sees |
| Made by | `buyer` or `seller` |
| Price | Offer amount |
| Actions | Inline `Accept` / `Counter Offer`, per §5.5 |

- The Buyer column identifies the **thread**, not who made the individual offer. A row made by the
  seller still carries the thread's buyer name, with `Made by = seller` marking authorship. That
  pairing is what lets one flat table represent several two-party conversations.
- Names are shown to **everyone** who can see the product — the seller, the thread's own buyer, and
  every competing buyer — consistent with the cross-buyer visibility §3.4 already requires.
- A buyer recognises their own thread by **their own name**; no additional marker is needed.
- The *seller's* name appears on the product card and Details header (`Seller: bob`) as §3.2
  requires, and the seller's offers appear here as `Made by = seller`.

### 5.2 Seller view, two competing threads, both awaiting the seller (PD-S2)

```
|  --- Negotiation history --------------------------------------------------  |
|                                                                              |
|  Timestamp          Buyer    Made by   Price      Actions                     |
|  ------------------------------------------------------------------------    |
|  2026-08-10 09:12   dan      buyer     $200.00    (history)                   |
|  2026-08-10 10:03   dan      seller    $240.00    (history)                   |
|  2026-08-10 11:20   erin     buyer     $210.00    [ Accept ] [ Counter ]      |
|  2026-08-10 14:47   dan      buyer     $220.00    [ Accept ] [ Counter ]      |
|                                                                              |
```

Rows are ordered by timestamp across **all** threads (interleaved), while actionability is computed
**per thread**. Rows 1–2 belong to dan's thread and are superseded by row 4, so they are history-only;
row 3 is the latest in erin's thread and row 4 is the latest in dan's, so both are actionable by the
seller.

Row 2 is the seller's own counter into dan's thread — the Buyer column still reads `dan` because it
names the thread, while `Made by = seller` names the author.

> **Rule R2 — concurrent threads (DECIDED, A14).** Multiple buyers' offers may await the seller at
> once — that is simply multiple threads. The seller **may** also push counters into several threads
> and leave them all unanswered simultaneously; there is **no limit on live seller counters** across
> threads. **Whoever acts first wins:** the first `Accept` — by either side, in any thread — sets the
> product to `Reserved` and freezes every other thread (§2.5 r5). A buyer whose `Accept` arrives
> second gets a **conflict, not a success**, handled by the existing stale-action treatment in §7 —
> no separate handling exists or is needed. Turn alternation (§2.5 r2) constrains only what happens
> *within* a thread; it never couples one thread to another.
>
> **Implementer note — not a bug:** once the seller has countered into *every* open thread, the
> seller has **no available action on that product at all** until some buyer responds. Every thread's
> latest offer is then the seller's own, so Gate 3 of §5.5 denies them everywhere and the action bar
> is empty. This is state **PD-S3**, and it falls straight out of the turn rules.

### 5.3 Buyer view — the viewer is `dan`, seller has countered (PD-B4)

```
|  Timestamp          Buyer    Made by   Price      Actions                     |
|  ------------------------------------------------------------------------    |
|  2026-08-10 09:12   dan      buyer     $200.00    (history)                   |
|  2026-08-10 10:03   dan      seller    $240.00    [ Accept ] [ Counter ]      |
|  2026-08-10 11:20   erin     buyer     $210.00    (not yours)                 |
```

dan sees erin's row — full cross-buyer visibility per §3.4, including erin's name and price — but can
never act on it. dan identifies his own rows by his own name in the Buyer column.

### 5.4 Frozen (product `Reserved` or `Sold`)

```
|  --- Negotiation history --------------------------------------------------  |
|  (i) Negotiation closed — this product is reserved for dan.                  |
|                                                                              |
|  Timestamp          Buyer    Made by   Price      Actions                     |
|  ------------------------------------------------------------------------    |
|  2026-08-10 09:12   dan      buyer     $200.00    —                           |
|  2026-08-10 10:03   dan      seller    $240.00    —                           |
|  2026-08-10 11:20   erin     buyer     $210.00    —                           |
|  2026-08-10 14:47   dan      buyer     $220.00    ACCEPTED                    |
```

The accepted row is marked; every row's Actions cell is empty (rule **R1**). The closing banner names
the winning buyer — the reserved buyer sees `reserved for you`, everyone else sees `reserved for dan`.

### 5.5 Rule table — when inline `Accept` / `Counter Offer` appear on a row

All three gates must pass. Failing any one renders the Actions cell inert.

**Gate 1 — product status:** `Available` only. `Reserved` and `Sold` freeze every row for every
viewer, including the reserved buyer, whose only remaining control is `Purchase` (rule **R1**).

**Gate 2 — recency:** the row is the **latest** offer in **its own thread** (§2.5 r3). A row that is
the newest on the page but not the newest in its thread is still history-only, and vice versa.

**Gate 3 — turn ownership:**

| Viewer | `row.madeBy` | Row's thread owned by viewer | Accept | Counter Offer | Why |
| --- | --- | --- | --- | --- | --- |
| Seller | `buyer` | n/a | **Yes** | **Yes** | Buyer moved; it's the seller's turn |
| Seller | `seller` | n/a | No | No | Seller's own offer — awaiting the buyer (§2.5 r2) |
| Buyer | `seller` | Yes | **Yes** | **Yes** | Seller countered into this buyer's thread |
| Buyer | `seller` | No | No | No | Not this buyer's thread |
| Buyer | `buyer` | Yes | No | No | Own offer — awaiting the seller |
| Buyer | `buyer` | No | No | No | Another buyer's offer entirely |

"Owned by viewer" keys off buyer identity directly: the row's thread buyer is the viewer. It is
visible in the row itself — the Buyer column carries the viewer's own name — so a buyer can always
see why a given row does or does not offer them controls.

Accept and Counter always appear and disappear **together** — there is no case where one is available
and the other is not.

**Action results**

| Control | Effect | Navigates to |
| --- | --- | --- |
| `Accept` | Product → `Reserved`, that row's thread buyer becomes the reserved buyer, that thread closes as won, all other threads on the product freeze (§2.5 r5) | **Product List** |
| `Counter Offer` | Opens the inline price panel (§6); on submit logs a new offer in that thread and flips the turn | **Product List** |

Accept takes no price input — the row's price is the agreed price (§2.5 r8) — and commits on a single
click with no confirmation step (A3, decided; the confirm step is bonus, §9.3). Both navigations are
plain, with no confirmation message on arrival (§2d).

---

## 6. Counter Offer — price entry interaction

One interaction pattern serves both entry points (the initial action-bar button and the inline row
control): an inline panel expanding in place. No modal — the panel needs to sit next to the price it
is responding to, and a modal would hide that context.

### 6.1 From the initial `Counter Offer` button (buyer, no thread yet)

```
|  [  Purchase  ]   [  Counter Offer  ]   <-- clicked                          |
|                                                                              |
|  +------------------------------------------------------------------+       |
|  |  Your offer                                                       |      |
|  |  Listed price: $250.00                                            |      |
|  |                                                                   |      |
|  |  Your price   $ [ 220.00 ......]                                  |      |
|  |                                                                   |      |
|  |  Submitting starts a negotiation. You will no longer be able to   |      |
|  |  buy this product at the listed price.                            |      |
|  |                                                                   |      |
|  |                       [ Cancel ]   [ Submit offer ]               |      |
|  +------------------------------------------------------------------+       |
```

The warning line is required, not decorative: submitting here permanently removes this buyer's
`Purchase` button (row 5 of §4.4), and core scope has no undo, withdraw, or cancel of any kind
(A7 — the bonus in §9.2 partially relieves this, but must not be assumed present).

### 6.2 From an inline row control

```
|  2026-08-10 09:12   dan      buyer     $200.00    (history)                   |
|  2026-08-10 10:03   dan      seller    $240.00    [ Accept ] [ Counter ]      |
|      +--------------------------------------------------------------+        |
|      |  Countering bob's offer of $240.00                            |       |
|      |                                                               |       |
|      |  Your price   $ [ 230.00 ......]                              |       |
|      |                                                               |       |
|      |                     [ Cancel ]   [ Submit counter ]           |       |
|      +--------------------------------------------------------------+        |
|  2026-08-10 11:20   erin     buyer     $210.00    (not yours)                 |
```

The panel opens directly beneath its row and names the party whose offer is being countered — the
seller (`bob`) in the buyer's view above, and the thread's buyer in the seller's view
(`Countering erin's offer of $210.00`) — so a seller juggling several threads can never counter the
wrong one.

**Elements**

| Element | Behaviour |
| --- | --- |
| Price input | Numeric, currency-prefixed, autofocused on open, max 2 decimals |
| `Submit offer` / `Submit counter` | Logs the offer, flips the turn → **Product List** (plain navigation, no confirmation — §2d) |
| `Cancel` | Closes the panel, logs nothing, stays on Product Details |

**Rules**

- Disabled `Submit` while: input is empty, non-numeric, ≤ 0, or a submit is in flight.
- The offer may be **above or below** the listed price and above or below the previous offer, in
  either direction (§2.5 r4) — no "must beat the last offer" validation. Do not add one.
- Opening one panel closes any other open panel; at most one is open at a time.
- `Accept` has no equivalent panel — it commits directly on one click, no confirm dialog (A3,
  decided; see §9.3 for the bonus confirmation step).

### 6.3 Validation error

```
|  |  Your price   $ [ 0 ..........]                                  |
|  |  (!) Enter an amount greater than 0.                             |
```

Other messages: `Enter a valid number.` / `Use at most 2 decimal places.`

---

## 7. Stale-action conflict (required)

Core scope is refresh-driven with no real-time updates (§4.1), so a viewer's page can be arbitrarily
stale. Every mutating action can therefore fail on the server's guarded update (§2.3). This is a
normal, expected outcome, not an exceptional error, and it needs a real UI.

**Presentation:** the action fails, the page re-fetches and re-renders in its new state, and a toast
reports that the action did not take effect. The user is never navigated away on a conflict — they
stay on Product Details and see the corrected reality.

The refreshed page *is* the explanation: the status reads `RESERVED` or `SOLD` and the controls the
viewer may no longer use are simply gone, exactly as they would be on a first visit. So the toast
carries only the one thing the page cannot say for itself — that the click did nothing — and then
disappears. No persistent banner, and nothing to dismiss.

```
+==============================================================================+
|                    +-----------------------------------------+              |
|                    | (x) This product is no longer available |              |
|                    |     Your purchase was not completed.    |              |
|                    +-----------------------------------------+              |
|  < Back to products                                                          |
|                                                                              |
|  Vintage Camera                                     Status: SOLD             |
|  Listed price: $250.00        Seller: bob                                    |
|  ...                                                                         |
|  (no action panel — page has re-rendered as PD-B7)                           |
```

**Conflict messages by attempted action**

The refusal the server gives is the toast's first line; the second line is fixed per action and states
that nothing happened.

| Attempted | Actual server state | Toast |
| --- | --- | --- |
| Purchase | now `Reserved` or `Sold` | `This product is no longer available` / `Your purchase was not completed.` |
| Purchase | viewer opened a negotiation elsewhere in the meantime | `Settle your open negotiation on this product before buying it` / `Your purchase was not completed.` |
| Accept | product now `Reserved` or `Sold` | `This product is no longer available` / `Your acceptance was not applied.` |
| Counter | product now `Reserved` / `Sold` | `This product is no longer available` / `Your offer was not sent.` |
| Counter / Accept | the other side already responded — the row is no longer the latest in its thread | `That offer has already been responded to` / `Your action was not applied.` |
| Any | the request never reached the server | `Couldn't reach the server…` / `Your … was not completed.` |
| Any | viewer's session expired | Redirect to **Login** |

Which of `Reserved` and `Sold` occurred is deliberately *not* spelled out in the message: the status
badge on the refreshed page below it already says which, so a second wording would only repeat it.

Every message states explicitly that the action did **not** take effect — the top UX risk here is a
buyer believing they bought something they did not.

Rule **R2** (§5.2) makes the losing-`Accept` rows above a routine occurrence rather than an edge case:
because the seller may hold live counters in several threads at once, two buyers can genuinely race to
accept, and exactly one of them lands here. No separate flow handles it — the second acceptance is a
conflict, and this section is that handling.

---

## 8. Flow map

```
                        +-----------+
                        |   LOGIN   |<---------------------------+
                        +-----------+                            |
                              |  login ok                        | Logout
                              v                                  | (header, any page)
     Sell  +------------------------------------+                |
    +----->|          PRODUCT  LIST             |----------------+
    |      |  (landing; empty / loading / error; |
    |      |   no post-action feedback in core) |
    |      +------------------------------------+
    |          ^   ^   ^   ^          |  click card
    |          |   |   |   |          v
    |          |   |   |   |   +--------------------------------------+
    |          |   |   |   |   |         PRODUCT  DETAILS             |
    |          |   |   |   |   |  PD-S1..S5  (seller views)           |
    |          |   |   |   |   |  PD-B1..B7  (buyer views)            |
    |          |   |   |   |   |                                      |
    |          |   |   |   +---|  < Back to products                  |
    |          |   |   |       |                                      |
    |          |   |   |       |  [Purchase] --> Sold ----------------+---> LIST
    |          |   |   |       |                                      |
    |          |   |   |       |  [Counter Offer] (initial)           |
    |          |   |   |       |        `--> price panel --submit-----+---> LIST
    |          |   |   |       |                `--cancel--> stays here
    |          |   |   |       |                                      |
    |          |   |   |       |  Negotiation history (inline rows)   |
    |          |   |   |       |    [Accept]  --> Reserved -----------+---> LIST
    |          |   |   |       |    [Counter] --> price panel --------+---> LIST
    |          |   |   |       |                                      |
    |          |   |   |       |  conflict --> banner + re-render, NO navigation
    |          |   |   |       +--------------------------------------+
    |          |   |   |
    |   +---------------------------+
    +-->|   PRODUCT  REGISTRATION   |
        |  [Submit] --> creates ----+---> LIST
        |  [Cancel] --> discards ---+---> LIST
        +---------------------------+
```

**Navigation invariants**

- Every completing mutation (Purchase, Accept, Counter submit, Registration submit) ends on Product
  List — the app has exactly one "you finished something" destination (§3.4) — and arrives silently,
  with no confirmation message in core scope (§2d).
- Every cancel stays put; only `< Back to products` and Cancel-on-Registration leave a page without a
  mutation.
- Only 4 routes exist: Login, Product List, Product Registration, Product Details. Everything else in
  this document is a state of one of those four.
- Any unauthenticated request for a non-Login route redirects to Login. Public/read-only deep links
  are an explicit non-goal (A8, decided).

---

## 9. Bonus scope

### 9.1 Placement notes (§4.2 of requirements.md) — placement only, not designed

| Bonus | Where it slots in |
| --- | --- |
| Status filter (`Available`/`Reserved`/`Sold`) | Filter bar row between the header and the card grid on Product List (marked in §2). **List ordering (A9) folds in here** — sort control and status filter ship together as one filter-bar feature, not separately. |
| Product search | Same filter bar, left of the status filter — a single text input over name/description. |
| "My offers" filter | Same filter bar as a toggle, showing only products where the viewer has a thread. |
| Real-time updates | No new layout: it replaces refresh-driven staleness on Product Details (status line, history table, action bar re-render in place) and mutes — but never removes — the §7 conflict banner. |
| Mobile responsiveness | Card grid collapses to one column; the Details action bar and history table stack vertically. |
| Price editing | An `Edit price` control next to the listed price on Product Details, visible only in state PD-S1 (seller + `Available` + zero offers across all threads). |
| Reservation expiry | A countdown line inside the §4.2 context banner on the `Reserved` states. |

The three subsections below were moved to bonus by product-owner ruling. They are **deliberately not
drawn into the core wireframes** — states PD-B1…PD-B7, §2d, and §4.2 above all describe core
behaviour without them.

### 9.2 Regain "Purchase at original price" for a negotiating buyer (A7)

Core scope accepts the stuck-buyer dead-end (state PD-B3) as a known limitation: a buyer whose seller
never responds has no controls at all. The remedy is **not** a withdraw/cancel action — threads are
never retracted. Instead the buyer regains a direct-purchase option at the **listed** price.

**Visibility rule — `Purchase at original price` is visible only when ALL hold:**

| # | Condition |
| --- | --- |
| 1 | Viewer is a buyer, never the seller |
| 2 | Product status is `Available` (rule **R1** still governs `Reserved`/`Sold`) |
| 3 | Viewer has an **open** thread on this product (this is what makes it distinct from the core `Purchase` button, which requires *no* thread) |
| 4 | The **latest** offer in that thread — regardless of which side made it — is **strictly below** the listed price |

**The gate exists to close an arbitrage hole.** Without condition 4 a buyer could offer *above* list,
then buy at list and pay less than they just offered. Strictly-below is required: an offer exactly
equal to the listed price also fails the gate, since there is nothing to gain and allowing it only
widens the rule's surface.

Notable properties:

- It does **not** depend on whose turn it is. Relieving PD-B3 — where the buyer is waiting on a seller
  who may never respond — is the entire point, so it must work while the ball is in the seller's court.
- It charges the **listed** price, not any offered price. The thread is simply abandoned in place when
  the purchase completes; its rows stay in history and freeze with everything else.
- The core `Purchase` button (§4.4 row 5, hidden for a buyer with an open thread) is unchanged. This
  is an additional, separately-labelled control, so the "negotiating forfeits direct purchase" rule
  still reads correctly for buyers whose latest offer sits at or above list.

### 9.3 Confirmation step on Purchase and Accept (A2/A3)

Core is one-click for both (§4.4, §5.5). The bonus inserts a confirm step before committing, since
both are irreversible and terminal with no undo anywhere in scope. Confirm text states the price and
the consequence — `Buy "Vintage Camera" for $250.00? This completes the sale.` /
`Accept dan's offer of $220.00? This reserves the product for them and freezes all other offers.`

Must be a **DOM modal** — see the constraint in §9.4.

### 9.4 Post-action confirmation modal (A13)

> **Built for Purchase.** The purchase variant is implemented on Product Details — title
> `Purchase successful`, body `You bought "<name>" for <final price>.`, one button `Back to products`.
> The remaining variants (offer sent / offer accepted / product listed) stay in bonus scope.

Replaces the "silent navigation" of §2d. On a completing action the user gets a blocking modal
rather than a banner:

```
+==============================================================================+
|////////////////////  semi-transparent backdrop  /////////////////////////////|
|////////  (blocks all interaction with the page beneath)  ////////////////////|
|/////////+------------------------------------------------+//////////////////|
|/////////|                                                |//////////////////|
|/////////|   Offer sent                                   |//////////////////|
|/////////|                                                |//////////////////|
|/////////|   Your offer of $220.00 on "Vintage Camera"    |//////////////////|
|/////////|   has been sent to the seller.                 |//////////////////|
|/////////|                                                |//////////////////|
|/////////|                   [ Back to products ]         |//////////////////|
|/////////+------------------------------------------------+//////////////////|
|//////////////////////////////////////////////////////////////////////////////|
+==============================================================================+
```

- The backdrop blocks further interaction until the user acts — this is what makes the outcome
  impossible to miss, unlike a dismissible banner.
- The button performs the navigation to Product List. The navigation happens on acknowledgement, not
  before it, so the modal is shown over the page the action was taken on.
- One variant per action: purchased / offer sent / offer accepted & product reserved / product listed.

> **⚠ Implementation constraint — DOM modal only.** This must be built from page markup. It must
> **never** be a native `alert()`, `confirm()`, or `prompt()`. A native dialog hard-blocks the browser
> automation used for QA, so a native implementation would break the automated test suite outright.
> The same constraint applies to the confirmation step in §9.3 and to any future dialog in this app.

---

## 10. Decision record — all items settled

Kept as a record so the reasoning stays visible. Each row began as an assumption drawn into an
earlier revision of these wireframes; the **Status** column shows where the product owner landed.

**Status key:** `DECIDED — CORE` (settled, drawn above) · `DEFERRED — BONUS` (settled, described in
§9, deliberately not drawn into core) · `NON-GOAL` (settled, will not be built). No item is `OPEN`.

| # | Question | Status | Ruling and where it lands |
| --- | --- | --- | --- |
| **A1** | §3.4 defines the initial `Counter Offer` button purely by "buyer who hasn't offered yet" and never mentions status. Should a buyer with no thread still see it when the product is `Reserved` or `Sold`? | **DECIDED — CORE** | **Confirmed as drawn, and promoted from inference to requirement.** Originally derived from §2.5 r7; it is now **rule R1** in its own right (§4.1): once `Reserved` or `Sold`, a product is not actionable by anyone other than the reserved buyer. Governs §4.4 rows 7–9, §4.5 rows 4–6, and Gate 1 of §5.5. |
| **A2** | Should `Purchase` be a one-click commit, or require a confirmation step? It is irreversible and terminal. | **DEFERRED — BONUS** | Core stays **one click** (§4.4). The confirmation step becomes a bonus refinement — §9.3. |
| **A3** | Same question for inline `Accept` — it locks the product to one buyer and freezes every other thread. | **DEFERRED — BONUS** | Core stays **one click** (§5.5). Same bonus as A2 — §9.3. |
| **A4** | History shows every buyer's name and price to every viewer (§3.4). Is that intentional, or should competing buyers be pseudonymised? | **DECIDED — CORE** | **Buyer names are shown**, exactly as requirements.md §3.4 specifies ("Each row shows: timestamp, buyer name, `madeBy`, price") — row spec in §5.1, drawn in §5.2–§5.4. Anonymising competing buyers behind per-product thread labels **was considered and rejected in favour of spec fidelity**: the concern was that real marketplaces don't expose rival bidders' identities, but pseudonymisation added a labelling scheme the spec never asked for, and required a self-marker on the viewer's own rows just to keep the per-thread actionability rules legible. No deviation from §3.4 remains. |
| **A5** | Is the final/accepted price public once `Sold`, or visible only to the two parties? | **DECIDED — CORE** | **The final/accepted price is public** to every viewer — §4.2 banner (`Sold at $220.00.`) and the `ACCEPTED` row in the frozen history (§5.4). Restricting it to the two transacting parties was considered as a bonus and **dropped entirely**: the negotiation history is public by §3.4, so a non-participant can simply read the amount off the last row of the winning thread. Masking the headline figure would buy almost nothing, and suppressing the history's price column instead would contradict §3.4. |
| **A6** | After a buyer's thread loses (someone else's offer was accepted), do they get any notice beyond the frozen history? | **NON-GOAL** | No notification of any kind will be built. The "reserved for another buyer" banner on revisit is the only signal, and a losing buyer may never learn the outcome. Accepted. |
| **A7** | Does the buyer's `Purchase` button return if their negotiation somehow ends without an accept? | **DEFERRED — BONUS** | The PD-B3 dead-end is **accepted as a known limitation of core scope** — no withdraw, no cancel, no expiry. The bonus remedy is not a retraction but a regained `Purchase at original price`, gated on the buyer's latest offer being strictly below the listed price — full visibility rule and rationale in §9.2. |
| **A8** | Unauthenticated deep-link to a product URL — redirect to Login, or show a public read-only view? | **NON-GOAL** | Public/read-only deep links will not be built. Everything requires a session; unauthenticated routes redirect to Login (§8). |
| **A9** | Product List ordering is unspecified. | **DEFERRED — BONUS** | No longer a standalone item — **folded into the status-filter bonus** (§9.1), shipping as one filter-bar feature. Core renders whatever default order the list query returns, with `Sold`/`Reserved` items neither hidden nor sunk (§3.2 only asks for a badge). |
| **A10** | Are description and images required at registration? | **DECIDED — CORE** | **Confirmed: description required, images optional.** Governs `Submit`'s enable rule (§3). |
| **A11** | Accepted image file types are unspecified (only count and size are given). | **DECIDED — CORE** | **Confirmed as drawn: JPEG / PNG / WebP**, validated at selection time (§3a). |
| **A12** | Currency and formatting are unspecified. | **DECIDED — CORE** | **Confirmed as drawn: USD, `$` prefix, 2 decimals**, no locale switching. |
| **A13** | Post-action feedback is not specified at all — the spec only says "returns to Product List". | **DEFERRED — BONUS** | Core is a **plain silent navigation, no banner** (§2d) — all four mutations give no confirmation. The bonus replaces this with a blocking **DOM modal** (backdrop + navigate button) — §9.4. That modal must never be a native `alert()`/`confirm()`/`prompt()`, which would hard-block QA browser automation. |
| **A14** | Can a seller counter *two different threads* into competing states and then accept either one later? | **DECIDED — CORE** | **Allowed, first to act wins** — no limit on live seller counters across threads (rule **R2**, §5.2). Reasoning: §2.5 r5's phrase "every other buyer's thread" presupposes other threads can be live; r2 constrains alternation only *within* a thread, not across them; and forbidding it would create a new stuck state where one unresponsive buyer freezes the seller out of every other thread on the product. A losing race resolves through the existing stale-action treatment (§7), not new handling. |
| **A15** | Is there any listing management for the seller (edit, delist, delete)? | **NON-GOAL** | No seller listing management will be built. PD-S1 keeps an empty action bar; a seller cannot correct a typo or withdraw a listing. (The `Available` + zero-offers price-edit bonus in §9.1 remains the sole exception, and is bonus-only.) |
