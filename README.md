# Linkby Marketplace

A marketplace where sellers list products and buyers either purchase them outright or negotiate a
price through counter-offers until one side accepts.

## Prerequisites

**Docker** with Compose v2 — `docker compose version` should print v2.x. That is the only
requirement to run the app: no Node, Postgres or object storage to install.

The test suites run inside the containers too. Node is needed only to type `npm test` rather than the
`docker compose exec` command it stands for.

## Start from a clean state

```bash
git clone <repository-url>
cd linkby-marketplace
docker compose up
```

That single command builds the images, starts Postgres and MinIO, creates the image bucket, applies
the migrations and loads the seed data before the API accepts traffic. Nothing needs to be created
by hand. The first run pulls and builds, so give it a few minutes; later runs start in seconds.

The app is ready when the web container prints its Vite URL. Open **http://localhost:5173**.

| Service | URL | Credentials |
| --- | --- | --- |
| Web app | http://localhost:5173 | see below |
| API | http://localhost:3000 · health at `/health` | bearer token from login |
| Postgres | `postgres://linkby:linkby@localhost:5432/linkby` | `linkby` / `linkby` |
| Object storage (S3 API) | http://localhost:9000 | `linkby` / `linkbysecret` |
| Object storage console | http://localhost:9001 | `linkby` / `linkbysecret` |

## Signing in

**There is no registration screen — that is deliberate**, and it is how the exercise is specified.
The three seeded users are the way in, and every one of them both sells and buys:

| Email | Password | Display name |
| --- | --- | --- |
| `alice@example.com` | `password123` | Alice |
| `bob@example.com` | `password123` | Bob |
| `carol@example.com` | `password123` | Carol |

Every tab of a browser profile shares one session, so being two users at once needs an incognito
window or a second browser.

The database also ships with fifteen products covering every product and negotiation state. Each
name ends `(Seeded Demo)` and its description says which state it demonstrates, so you can tell them
apart from the list without consulting any table.

## Try it in five minutes

This walks a product through both paths — a direct purchase, then a full negotiation.

1. **Buy something outright.** Sign in as **Bob**. Open product **#2**, an available listing of
   Alice's with no offers on it, and press *Purchase*. A confirmation appears; return to the list
   and the card now reads `Sold`.
2. **Open a negotiation.** Sign out, sign in as **Carol**. Open product **#5**, press
   *Counter Offer*, enter an amount and submit. You stay on the page, and your offer appears in the
   negotiation history below.
3. **Accept it.** Sign out, sign in as **Alice**, who is selling #5. Her newest row from Carol
   carries *Accept* and *Counter Offer* — press **Accept**. The product moves to `Reserved`, and the
   accepted offer is marked in the history.
4. **Complete the sale.** Sign back in as **Carol**. The product now says it is reserved for her and
   offers *Purchase* at the agreed amount rather than the listed one. Buy it, and it becomes `Sold`.

Product #5 already carries a negotiation between Alice and Bob that is waiting on Bob, so step 2 also
shows two independent threads interleaved in one chronological history.

## Running the tests

```bash
npm test                               # 68 unit tests
npm run test:smoke                     # 22 HTTP tests
```

Both run inside the containers, so nothing is installed on your machine and both need
`docker compose up` already running.

The smoke suite exercises the real API against the running database, including three concurrency
races. It writes to that database, so run it before relying on the seeded rows, or reset afterwards.

## Resetting

```bash
docker compose down -v && docker compose up
```

`-v` removes the Postgres and MinIO volumes, so the next start migrates and seeds from scratch.
Seeding is guarded and safe to repeat: it skips if the database already holds data, and
`docker compose run --rm seed npm run db:seed -- --force` reseeds deliberately.

## About the committed `.env`

`.env` is checked in **on purpose**, so the stack runs straight from a clone with nothing to fill in.
Its values are local container credentials and a development signing key — they are not secrets, and
this exercise is not deployed anywhere. A real deployment would keep `.env` out of the repository and
read those values from a secret store; every sibling file (`.env.local`, `.env.production`) is
already gitignored so one cannot be committed by accident.

## Known limitations

- **A buyer who opens a negotiation gives up the direct purchase option** and depends on the seller
  answering. There is no way back to the listed price short of the seller accepting or countering.
- **Sellers cannot edit or delete a listing** once it is created, and prices are fixed at listing
  time.
- **Nothing is pushed.** Another user's offer or purchase appears when you reload or revisit the
  page, not while you are looking at it.
- **Losing buyers are not notified.** When an offer is accepted, the other threads simply go dead.
- **Every screen requires a session** — there are no public product links to share.
- Deliberately out of scope: payment processing and receipts, quantities (each listing is one item),
  a registration UI, product search, real-time updates, and reservation expiry or cancellation.

## How it works

[`docs/architecture.md`](./docs/architecture.md) covers the repository layout and the shared
contract between the API and the browser, the infrastructure the Compose file brings up, the
database design and what each table deliberately does not have, where the business rules live and
why the browser holds no copy of them, and how concurrent purchases and accepts are made safe.

## How this was built

Each document holds one kind of thing, and each was written before the code it describes.

| Document | Holds |
| --- | --- |
| [`docs/requirements.md`](./docs/requirements.md) | The canonical spec. Where anything disagrees with it, it wins. |
| [`docs/tasks.md`](./docs/tasks.md) | 28 tickets — user story, acceptance criteria, QA steps, dependencies, estimate, and a status line carrying the date its QA was run. |
| [`docs/wireframes.md`](./docs/wireframes.md) | Screen-by-screen layouts, UI states, and button-visibility rules. |
| decision log | Every technical and UX decision with the alternatives weighed against it. Kept as a working document and deliberately untracked, so it is not in this repository. |

The loop per ticket was the same: agree the approach, record the decision and what it was chosen
over, implement, then run that ticket's QA steps by hand — in a browser for anything with a UI,
with `curl` or SQL for anything without one — before its status line moves to `Done`. The backend
was built first as one batch, then the frontend, and each ticket is its own commit.
