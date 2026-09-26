# Kartly

A custom-designed ecommerce storefront with a real backend: PostgreSQL for the catalogue, a
persistent cart and order history, and account sign-up and sign-in. The interface, the information
architecture and the data model are all original to this project.

**Live:** https://kartly-amazon-rebuild.vercel.app
**Repository:** [FarhanFK2003/kartly-amazon-rebuild](https://github.com/FarhanFK2003/kartly-amazon-rebuild), branch `full-stack-revamp`

Nothing here is for sale. No payment is processed and no card details are collected or stored —
the checkout is deliberately simulated and says so on screen. Every brand and product in the
catalogue is fictional.

---

## What it does

- **Browse and search** 120 products across 10 departments, with faceted filtering, sorting and
  pagination, all driven from the URL so a result set can be shared or reloaded.
- **Product pages** with variants, specifications, review bodies and rating histograms.
- **A cart that persists** in PostgreSQL, keyed to a session — it survives a refresh, a new tab
  and a navigation, and is priced entirely by the server.
- **Orders** written to the database, with idempotent creation and per-account isolation.
- **Accounts** — sign up, sign in, sign out, backed by real password hashing and server sessions.
- **Responsive** from 375px to desktop.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5.9, React 19 |
| Styling | Tailwind CSS v4, design tokens in `app/globals.css` |
| Database | PostgreSQL 18, hosted on Neon |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | `bcryptjs`, session tokens hashed with `node:crypto` |
| Client state | Zustand — UI state only |
| Search relevance | Fuse.js |
| Hosting | Vercel |

## Architecture

```
Browser
  │
  ▼
Next.js App Router  ──  server components render on the server per request
  │
  ├─ lib/data/*     ──  server-only read/write layer (products, search, cart, orders)
  ├─ lib/auth.ts    ──  accounts and sessions
  └─ app/api/*      ──  HTTP API for external consumers
        │
        ▼
     Prisma  ──▶  PostgreSQL (Neon)
```

The storefront reads the database **directly** through `lib/data/*` rather than calling its own
HTTP API — a server component fetching from its own server would add a network hop and a second
failure mode for no benefit. `app/api/*` exists for consumers outside the app.

Every one of those modules begins with `import "server-only"`, so pulling database code into a
client bundle is a build error rather than a leak.

Product data, cart contents, orders and accounts all live in PostgreSQL. `data/catalog.json`
remains in the repository as the **seed source** only; nothing in a request path reads it, and the
QA suite enforces that by walking the import graph and inspecting the built output.

### Two kinds of session

| Cookie | Identifies | Lifetime |
|---|---|---|
| `kartly_sid` | A guest — owns a cart, and orders placed while signed out | 1 year |
| `kartly_auth` | A signed-in account | 30 days |

They are deliberately separate. Signing out ends a session; it does not empty the cart. Signing in
does not disturb what a guest was already shopping for.

## Authentication

Minimal by design: sign up, sign in, sign out, and "who am I" — `POST /api/auth/signup`,
`/login`, `/logout`, and `GET /api/auth/me`.

- Passwords are **bcrypt** hashes. Plaintext is never stored, logged or returned; the only shape a
  user leaves the auth module in has no `passwordHash` field to leak.
- A session token is 32 random bytes. The database stores only its **SHA-256** — the raw token
  exists in one place, an `httpOnly` cookie — so a leaked database dump cannot be replayed as a
  login.
- Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.
- An unknown email and a wrong password return the same 401 **and** both run a hash comparison, so
  neither the response nor its timing reveals which addresses are registered.

## Commerce

- **The server prices the cart.** The API accepts a product id, an optional variant id and a
  quantity — there is no price, subtotal or total field anywhere in the request shape. Every
  figure is resolved from the product rows and computed by `lib/commerce.ts`, which is the same
  module the UI has always used, so there is no second pricing formula.
- **Orders are idempotent.** Each checkout attempt carries a unique key; resubmitting returns the
  original order rather than creating a second one.
- **Order items are snapshots.** Title, price and variant are copied onto the order, so a later
  catalogue change cannot rewrite what someone bought.
- **Orders are scoped to their owner** — an order id alone is not authorisation, and someone
  else's order is a 404 rather than a 403 so ids cannot be enumerated.
- **The checkout draft stays client-side** (`kartly.checkout`): step, address and payment method
  only, so a refresh mid-flow doesn't empty the form. It carries no authority — the server
  recalculates everything at order time — and card details are excluded from persistence entirely.

## Running locally

```bash
npm install            # postinstall runs `prisma generate`
```

Create a `.env` at the project root containing your **own** database credentials:

```
DATABASE_URL="postgresql://…"
```

`.env.example` is the tracked template and holds placeholders only. `.env` is git-ignored.
`DIRECT_URL` is optional and only needed when `DATABASE_URL` points at a connection pooler that
cannot run DDL — Neon and Supabase both do.

```bash
npm run db:migrate     # apply migrations to an empty database
npm run db:seed        # load data/catalog.json — idempotent
npm run dev            # http://localhost:3000
```

> On Windows, `localhost` may resolve to IPv6 while the server binds IPv4. Use `127.0.0.1:3000`.

Because every route renders per request, `next build` succeeds without a database — a missing
`DATABASE_URL` fails at request time, where it is obvious, rather than silently.

## Database

| Command | What it does |
|---|---|
| `npm run db:generate` | Regenerate the Prisma client after a schema change |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply existing migrations without creating one |
| `npm run db:seed` | Load the catalogue. Safe to run repeatedly. |
| `npm run db:reset` | **Drops the database**, re-applies every migration, re-seeds |
| `npm run db:studio` | Prisma Studio against the current database |

Every migration in `prisma/migrations/` is **additive** — no `DROP`, `TRUNCATE` or `DELETE`. The
seed is idempotent: writes are upserts keyed on the catalogue id, so running it twice produces the
same database rather than a second copy.

Production migrations are run **intentionally**, not as part of every deployment. The build only
runs `prisma generate`; `db:deploy` is a deliberate step so a schema change can never ride along
with an unrelated deploy.

`docs/backend.md` has the fuller version: schema decisions, the Prisma 7 differences that trip up
code written against version 6, and how to verify the data is real.

## Catalogue

Generated deterministically from seeds, so rebuilding produces an identical file:

```bash
npm run catalog        # regenerate data/catalog.json
npm run images         # download missing imagery (idempotent)
```

Ratings, review counts, deals, stock and delivery windows come from a PRNG seeded on each product
id; rating histograms are solved so the bars always agree with the headline star value.

Imagery is from [Openverse](https://openverse.org), downloaded at build time and committed — the
deployed site makes no runtime request to any third-party image host. 108 of 120 images are CC0 or
Public Domain Mark; 12 use CC-BY / CC-BY-SA, each credited in [ATTRIBUTION.md](ATTRIBUTION.md)
with creator, licence and source.

## Testing

QA drives a real browser against a **production build** and asserts on behaviour, not markup.
Selectors come from a single shared contract (`lib/testids.ts` ↔ `scripts/qa/selectors.mjs`) so a
visual change cannot silently invalidate assertions.

```bash
npm run build && npm run start
node scripts/qa/<suite>.mjs out/       # KARTLY_BASE overrides the target
```

| Suite | Result | Covers |
|---|---|---|
| `auth` | **31/31** | Sign-up, sign-in, sign-out, session security, account isolation |
| `backend` | **31/31** | API contract, error handling, catalogue-independence proof |
| `storefront-db` | **34/34** | Every storefront surface, plus a live mutation proof |
| `persistence` | **35/35** | Cart and order persistence, server price authority |
| `purchase` | **65/65** | PDP → drawer → cart → checkout → confirmation |
| `responsive` | **231/231** | 375px to 1440px, overflow and tap targets |
| `navigation` | **127/127** | Header, search overlay, department drawer, mobile tabs |
| `pdp` | **108/108** | Product detail behaviour |
| `discovery` | **83/83** | Search, facets, sorting, pagination |
| `home` | **60/60** | Homepage shelves and hero |
| `smoke-final` | **22/22** | End-to-end happy path |
| **Full regression** | **696/696** | |

Two checks are worth singling out, because they are what separate a real backend from a convincing
one:

- **The mutation proof.** A product's title and price are changed directly in PostgreSQL, the real
  page is loaded in a browser, and the rendered HTML must show the new values — then the row is
  restored and the page must show the originals. Mock data cannot pass this.
- **The bundle proof.** The API's import graph is walked and the compiled output inspected for
  chunks containing catalogue text. It carries its own control, so "no hits" cannot be confused
  with a broken probe.

Suites that write to the database claim an identifiable session and purge what they create, before
and after each run, so repeated runs leave nothing behind.

Production was verified against the deployed URL after release: storefront 34/34, auth 31/31,
backend 31/31, responsive 231/231, with 0 page errors, 0 hydration errors, 0 unexpected 4xx/5xx
and no secrets in any client bundle.

## AI-assisted development

This project was built with Claude Code used as an engineering agent, under a deliberate workflow
rather than open-ended generation:

- **Focused waves.** Each phase had an explicit scope — navigation, discovery, homepage, PDP,
  purchase flow, backend, storefront migration, commerce persistence, authentication — with
  protected files and a stated list of what *not* to touch.
- **Inspect before changing.** Each wave began by reading the relevant code and reporting what was
  actually there, rather than assuming.
- **Targeted QA after every phase**, and a full regression before each milestone.
- **A Git checkpoint per wave**, so any phase can be inspected or reverted on its own.
- **Agent logs retained** in `.agent-logs/`, captured automatically and committed alongside the
  code they produced.

Decisions were verified rather than trusted: through browser-driven tests, direct database
queries, computed-style checks, import-graph and bundle inspection, HTTP response and cookie
inspection, and `git diff` review before every commit. Several defects were found this way that
looked correct on screen — a button colour silently dropped by class merging, a transaction
timeout that only appeared under load, orders scoped to the browser rather than the account. The
work was reviewed at each step, and the tests are the evidence.

## Engineering decisions

- **A real database, not a mock.** The catalogue moved into PostgreSQL with a migration and a
  reproducible seed, and the tests prove the running app reads from it.
- **Server-authoritative pricing.** The client cannot name a price, because there is nowhere in
  the request shape to put one.
- **Idempotent orders.** A unique key per attempt; two racing requests end with one order.
- **Cross-session isolation.** Orders belong to an account, not to a browser.
- **Secure sessions.** `httpOnly` cookies, bcrypt passwords, hashed session tokens.
- **Guest and account kept separate,** so signing in or out never disturbs a cart.
- **A hydration guard on purchase actions.** Pages render per request, so Add to Cart is disabled
  until React has attached its handlers — an honest "not yet" rather than a silently dropped click.
- **Deterministic catalogue with recorded provenance**, including image licences.
- **Self-cleaning QA**, so test runs never accumulate data.

## Known limitations

- **Authentication is intentionally minimal.** No password reset, email verification, OAuth or
  two-factor. Those are each a feature, and a half-built one is worse than its absence.
- **Cold production latency is higher than it should be.** Vercel is serving from Washington DC
  while the Neon database is in Singapore, so every query crosses the Pacific. It is a region
  configuration issue rather than a functional fault — everything works, first paint is just
  slower than it would be with the two co-located.
- **An order placed as a guest does not follow you into an account.** Claiming guest orders on
  sign-in is a separate feature; isolation was the requirement.
- **Some catalogue imagery is only loosely related** to the product it illustrates. Openly-licensed
  pools contain little true product photography; the most prominent images were corrected, and
  deeper mismatches remain a known, accepted tradeoff.

## Agent logs

`.agent-logs/` holds the automatic capture of every prompt and final response used to build this,
committed alongside the code it produced. See [CAPTURE-TEST.md](CAPTURE-TEST.md).
