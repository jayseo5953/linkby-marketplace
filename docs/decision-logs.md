# Decision Log

Every technical, UX and scope decision, with the alternatives that were weighed and rejected.
Canonical requirements live in [`requirements.md`](./requirements.md) — this file records *how and
why*, never *what the product must do*.

**Adding an entry.** Append to the relevant section with the next free ID. Keep to the four lines:

```
### T-00 · Short title
**Decision.** What was chosen.
**Why.** The reasoning, in a sentence or two.
**Rejected.** Each alternative and the reason it lost.
**Cost.** What this knowingly gives up. Omit if nothing.
```

IDs are never reused. A reversed decision keeps its entry and gains a `**Reversed.**` line rather
than being deleted.

---

## Technical

### Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript, both ends |
| Repo | npm workspaces monorepo, no Turborepo |
| Backend | Express 5 |
| ORM | Drizzle + drizzle-kit |
| Database | PostgreSQL |
| Validation / schemas | zod, shared front and back |
| Object storage | `@aws-sdk/client-s3` + `s3-request-presigner`, pointed at MinIO |
| Auth | Stateless JWT in an `Authorization` header |
| Frontend | Vite + React |
| Server state | TanStack Query |
| Client state | React Context (auth only) |
| UI | Tailwind + shadcn/ui |
| State machine | Hand-rolled |
| Tests | Vitest |
| Logging | pino |
| Containers | Docker Compose |

Supporting picks, uncontroversial: `multer`, `bcrypt`, `cors`, `react-router`, `supertest`,
eslint + prettier on a single root config.

### T-01 · ORM: Drizzle

**Decision.** Drizzle + drizzle-kit.
**Why.** The two graded backend criteria — atomic status transitions (§2.3) and no N+1 (§5) — are
SQL-shaped. Drizzle puts the guard in the `WHERE` clause where a reviewer can see it, makes
`.for('update')` native, and emits plain `.sql` migrations. No codegen or engine binary, so the
Docker build stays boring. `$inferSelect` is erased at compile time, keeping the shared package
dependency-free and browser-importable.
**Rejected.** *Prisma* — needs `$queryRaw` for row locks at exactly the graded point, can't express
CHECK constraints in its schema, and its codegen plus libc-matched engine binary is a build risk
against a hard Docker requirement. *TypeORM* — entity classes drag `reflect-metadata` into any
importer, so they can't cross into the browser bundle, which would force the button-visibility
rules to be written twice; also stringly-typed queries and lazy-loading N+1s. *Raw `pg`* —
hand-rolled row mapping discards the type safety that justifies the monorepo.
**Cost.** No encapsulation boundary; nothing structurally stops an ad-hoc write bypassing domain
rules. Would likely flip on a larger schema or team.

### T-02 · Monorepo: npm workspaces, no Turborepo

**Decision.** npm workspaces.
**Why.** The monorepo exists to share zod schemas so DTO types have one definition. npm's layout
survives a naive Dockerfile without symlink or corepack surprises.
**Rejected.** *Turborepo* — its task graph pays off around ten packages or in CI; here it's config
for no benefit. *pnpm* — better tool, but higher risk for "must run on a stranger's laptop".

### T-03 · zod as the single schema definition

**Decision.** One zod schema per contract, types via `z.infer`. Backend request validation and
frontend form validation share it.
**Rejected.** Wrapper libraries (`celebrate`, `zod-express-middleware`) — the Express integration
is a small middleware written once.

### T-04 · Express 5

**Decision.** Express 5 over 4.
**Why.** Async rejections forward to the error handler natively, removing the
`express-async-errors` patch.
**Cost.** Fall back to 4 if middleware friction appears early — not worth a fight.

### T-05 · Hand-rolled state machine

**Decision.** Hand-rolled transitions.
**Why.** Three states, three transitions. §8 grades explicitly against over-engineering.
**Rejected.** XState — more machinery than the domain has.

### T-06 · Money as integer cents

**Decision.** Store and compute in integer cents.
**Why.** Avoids floating point, and sidesteps Drizzle returning `numeric` columns as strings.

### T-07 · No zustand

**Decision.** React Context for auth; no client-state library.
**Why.** Once TanStack Query owns server state, the only global state is the user and token. A
store holding one object is surface for no benefit.
**Cost.** Revisit if genuine cross-tree client state appears.

### T-08 · JWT in a header

**Decision.** Stateless JWT in an `Authorization` header.
**Why.** No CSRF surface, and trivially stateless per §5's horizontal-scalability requirement.
**Rejected.** httpOnly cookie — CSRF handling for no gain on a seeded-user exercise.
**Cost.** A token in `localStorage` is XSS-readable. Production would use httpOnly + SameSite
cookies with CSRF tokens.

### T-09 · AWS SDK v3 over the MinIO SDK

**Decision.** `@aws-sdk/client-s3` with `endpoint` and `forcePathStyle: true`.
**Why.** Removing those two options points it at real S3, which is what makes §5's "swapping to S3
is a config change, not a rewrite" literally true. The MinIO-specific SDK would not.

---

## UX

UI behaviour, visibility rules, and interaction decisions.

> Not yet migrated. The UX rulings (A1–A15) currently live in [`wireframes.md`](./wireframes.md)
> §10.

---

## Scope

What is deliberately not being built, and why.

> Not yet migrated. Core exclusions are in `requirements.md` §4.1; the additional rulings from
> review are recorded in `wireframes.md` §10.

---

## Not decided yet

- Project structure and package layout
- Database schema, constraints and indexes
- API surface and routing
- Invariant enforcement and concurrency approach
- Docker Compose topology and AWS deployment notes
- Testing strategy beyond the choice of runner
