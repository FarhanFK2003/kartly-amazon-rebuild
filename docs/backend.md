# Kartly backend

PostgreSQL, Prisma, and the product API.

This document covers what the backend is, how to run it locally, and how to
check that it is genuinely reading from a database. It contains no credentials;
every connection string here is a placeholder.

---

## 1. What is actually in the database

The catalogue lives in PostgreSQL across five tables:

| Table              | Rows | Holds                                                    |
| ------------------ | ---: | -------------------------------------------------------- |
| `categories`       |   10 | Departments, with catalogue order                         |
| `brands`           |   12 | Derived from the products that reference them             |
| `products`         |  120 | The catalogue, keyed by its original id                   |
| `product_variants` |   83 | Colour and size options, with price deltas and order      |
| `reviews`          |  672 | Review bodies                                             |

`data/catalog.json` is still in the repository, and it is still the origin of
this data — but it is now a **seed source**, not a runtime store. Exactly one
file reads it (`prisma/seed.ts`), and nothing in a request path imports it. The
backend QA suite enforces that by walking the API's import graph.

### Schema decisions worth knowing

**Product ids are the catalogue ids, not generated keys.** `electronics-01` is
already in product URLs, cart lines, related-product links and the QA suites.
Generating fresh keys would have meant rewriting all of that for no benefit.
`slug` is unique as well, because `/dp/[id]` resolves by either.

**`specs` is a JSON column.** The 120 products carry 115 distinct specification
key sets — a laptop and a paperback share almost nothing. A relational spec
table would be a key/value bag with no constraints worth enforcing. Everything
else is modelled relationally.

**`ratingHistogram` is stored rather than derived.** `reviewCount` runs into the
thousands while only a handful of review bodies exist per product, so the
histogram describes ratings the `reviews` table does not contain. Computing it
from `reviews` would quietly change every rating breakdown in the UI.

**`position` is a real column on categories, products and variants.** For
categories and products it keeps "featured" order stable. For variants it is
behaviour, not presentation: the product detail page selects the first variant
by default, so a variant arriving in a different order changes the price shown
on first paint.

**Money is stored in minor units as `Int`,** matching `lib/commerce.ts`. Never a
float.

---

## 2. Architecture

```
  data/catalog.json ──seed──▶  PostgreSQL
                                  │
                                  │  Prisma + @prisma/adapter-pg
                                  ▼
                               lib/db.ts          single client, lazily created
                                  │
                ┌─────────────────┴──────────────────┐
                ▼                                    ▼
      lib/data/*  (server-only)               app/api/*  (HTTP)
                │                                    │
   ┌────────┬───┴────┬──────────┐        ┌───────────┼──────────────┐
   ▼        ▼        ▼          ▼        ▼           ▼              ▼
  /      /browse    /s      /dp/[id]  products  products/[id]    health
```

The storefront reads the database directly through `lib/data/`; it does not call
its own HTTP API. A server component making an HTTP request to its own server
would add a hop and a second failure mode for no benefit. See section 7.

| File                      | Role                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `prisma/schema.prisma`    | The schema. No connection URL — Prisma 7 removed it from here.     |
| `prisma.config.ts`        | CLI configuration: schema path, migrations path, seed command, URL |
| `prisma/seed.ts`          | Reads the catalogue, upserts it. Idempotent.                       |
| `lib/db.ts`               | The Prisma client. The whole database layer.                       |
| `lib/api/products.ts`     | Query parsing, the `where`/`orderBy` builders, the response shape  |
| `lib/api/errors.ts`       | The single exit for a failed request                               |
| `lib/data/products.ts`    | The storefront's product and category reads (server-only)          |
| `lib/data/search.ts`      | The storefront's faceted search (server-only)                      |
| `lib/search-params.ts`    | The search URL contract. Pure; touches no product data             |
| `app/api/products/`       | The product routes                                                 |
| `app/api/health/`         | Connectivity and row counts                                        |
| `app/(shop)/diagnostics/` | A page rendered entirely from the database                         |

### Prisma 7 differences

Three things changed in Prisma 7 that trip up anything written against version 6:

1. **`url` and `directUrl` were removed from the `datasource` block.** The CLI
   reads the connection string from `prisma.config.ts` instead.
2. **The client requires a driver adapter.** `lib/db.ts` passes `PrismaPg` from
   `@prisma/adapter-pg`, which is why the connection string is read in that file
   rather than declared in the schema.
3. **The CLI no longer loads `.env`.** It passes `dotenv: false` to its config
   loader, so `prisma.config.ts` loads the file itself with
   `process.loadEnvFile`. Next.js still loads `.env` for the application.

---

## 3. Local setup

### Prerequisites

- PostgreSQL 16 or 17, running locally
- Node 22 (`process.loadEnvFile` is used, which needs 20.12+)

### Create the database

Connect as a superuser and create a database and a role for the app:

```sql
CREATE DATABASE kartly;
CREATE USER kartly WITH PASSWORD '<choose-one>';
GRANT ALL PRIVILEGES ON DATABASE kartly TO kartly;
\c kartly
GRANT ALL ON SCHEMA public TO kartly;
```

The last line matters on PostgreSQL 15 and later, where `public` is no longer
writable by every role.

### Configure the environment

```bash
cp .env.example .env
```

Then edit `.env` and set `DATABASE_URL` to the database you just created. The
file is git-ignored; `.env.example` is the tracked template and holds
placeholders only.

```
DATABASE_URL="postgresql://kartly:<password>@127.0.0.1:5432/kartly?schema=public"
```

`DIRECT_URL` is optional and only needed when `DATABASE_URL` points at a
connection pooler that cannot run DDL — Neon and Supabase both do this. Against
a local server, leave it unset.

### Create the schema and load the data

```bash
npm install          # postinstall runs prisma generate
npm run db:migrate   # applies prisma/migrations to an empty database
npm run db:seed      # loads data/catalog.json
```

Expected seed output:

```
Seeded: 10 categories, 12 brands, 120 products, 83 variants, 672 reviews
```

---

## 4. Commands

| Command              | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `npm run db:generate` | Regenerate the Prisma client. Run after editing the schema.         |
| `npm run db:migrate`  | Create and apply a migration from schema changes (development)      |
| `npm run db:deploy`   | Apply existing migrations without creating one (production)         |
| `npm run db:seed`     | Load the catalogue. Safe to run repeatedly.                         |
| `npm run db:reset`    | **Drops the database**, re-applies every migration, re-seeds        |
| `npm run db:studio`   | Open Prisma Studio against the current database                     |

### Reseeding

`npm run db:seed` is idempotent. Every write is an upsert keyed on the catalogue
id, so running it twice produces the same database, not a second copy. Variants
and reviews are deleted and re-created per product, which keeps the catalogue
authoritative: a variant the catalogue no longer lists does not survive a
reseed.

### Resetting

`npm run db:reset` drops and rebuilds everything. It is the right move when a
migration has gone wrong locally, and the wrong move against anything shared —
it will ask for confirmation.

---

## 5. The API

### `GET /api/products`

| Parameter  | Values                                                      | Default    |
| ---------- | ----------------------------------------------------------- | ---------- |
| `q`        | Substring match on title, brand or category name             | —          |
| `category` | Category id, e.g. `electronics`                              | —          |
| `brand`    | Brand name, case-insensitive                                 | —          |
| `sort`     | `featured`, `price-asc`, `price-desc`, `rating`, `newest`    | `featured` |
| `page`     | 1-based integer                                              | `1`        |
| `limit`    | 1–100                                                        | `16`       |

```json
{
  "products": [ … ],
  "pagination": { "page": 1, "limit": 16, "total": 120, "totalPages": 8 },
  "source": "postgres"
}
```

Filtering, sorting and paging all happen in PostgreSQL; the route never loads
the catalogue into memory to slice it.

The `sort` values are the same ones the search URL contract already uses, taken
from `SORT_OPTIONS` in `lib/search.ts`, so the API and the front end cannot
drift into two vocabularies.

### `GET /api/products/[id]`

Resolves by catalogue id **or** slug, matching what `/dp/[id]` accepts. Returns
`404` with `{"error":"Product not found"}` for anything unknown.

### `GET /api/health`

Runs `SELECT 1` and returns row counts and round-trip latency. Use it to tell
"the database is empty" apart from "the database is unreachable".

### Errors

Every failure leaves through `lib/api/errors.ts`, which returns a fixed string
and logs the real error server-side. This is deliberate: a Prisma connection
error carries the host, port, user and database name, and a constraint violation
carries column names and sometimes row values. None of that belongs in an HTTP
response. Clients see `400` with a message we wrote, `404`, or a bare
`500 Internal server error`.

---

## 6. Verifying it is real

```bash
npm run build && npm start        # or npm run dev
node scripts/qa/backend.mjs out/
```

Two suites cover this. `scripts/qa/backend.mjs` checks the API and the database;
`scripts/qa/storefront-db.mjs` checks the customer-facing pages, and ends by
changing a product's title and price in PostgreSQL, loading the real product
page in a browser, requiring the rendered HTML to show the changed values, then
restoring the row and requiring the page to show the originals again.

The backend suite runs 31 checks. Four of them are the ones that matter:

- It walks the import graph of every API route and fails if any reachable file
  reads `catalog.json` or is `lib/catalog.ts`. Type-only imports are not
  followed, because TypeScript erases them and they create no runtime edge.
- It then checks the **built output**, which is what actually runs: it finds the
  compiled chunks that physically contain catalogue text and fails if a product
  or health route loads one. `/api/suggest` serves as the control - it really
  does read the catalogue, so if the probe cannot see that, the probe is broken
  and the other results mean nothing.
- It **changes a product title directly in PostgreSQL**, requests that product
  from the API, and requires the response to have changed — then restores the
  row. Mock data cannot pass this.
- It asserts that error responses contain no connection string, password, port,
  driver name or stack frame.

By hand:

```bash
curl -s localhost:3000/api/health
psql "$DATABASE_URL" -c "UPDATE products SET title='CHANGED' WHERE id='electronics-01';"
curl -s localhost:3000/api/products/electronics-01   # title is now CHANGED
npm run db:seed                                      # puts it back
```

Or open `/diagnostics`, which renders its row counts and sample product from the
database on every request.

---

## 7. The storefront read layer

The customer-facing pages read PostgreSQL through `lib/data/`, not through the
HTTP API. A server component calling back into its own server over HTTP would
add a network hop and a second failure mode for no benefit; the API exists for
external consumers.

| Module                  | Role                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `lib/data/products.ts`  | Products, categories, department statistics, card projections |
| `lib/data/search.ts`    | Faceted search: filters, counts, sorting, pagination        |
| `lib/search-params.ts`  | The URL contract — pure, no product data                    |

Three properties it holds to:

- **`import "server-only"`.** Pulling either module into a client bundle is a
  build error. That is what keeps the catalogue and the credentials out of the
  browser.
- **No static fallback.** If PostgreSQL is unreachable the request fails. A
  storefront that quietly serves fixtures when its database is down is worse
  than one that errors, because nobody finds out.
- **`cache()` on every entry point.** The header, the cards and the breadcrumb
  all want the category list; they issue one query between them, not three.

### Search

Filtering, sorting, pagination and every facet count are SQL. The counts are
issued as one batch and each one deliberately ignores its own dimension, so a
shopper sees how many results *adding* another brand would return.

Text relevance is the single exception, and a considered one. The search is
fuzzy — "labtop" finds laptops — and ranks by Fuse's score. Postgres cannot
reproduce that ranking without `pg_trgm` and a different scoring model, which
would silently change which result comes first. So when there is a query, a
narrow projection (id, title, brand, imageQuery, categoryId, bullets — no
reviews, specs or images) is read **from the database** and ranked with the
identical Fuse configuration; the resulting id list is then filtered, sorted and
paged in SQL. The source of truth is PostgreSQL either way: a deleted row cannot
appear, and an edited title is matched on its new value. This is ranking, not
storage.

### Rendering and caching

Every route is server-rendered per request. There is no `generateStaticParams`
and no revalidate window, so **a change in PostgreSQL is on the page at the next
request** — which is the point of the migration, and what
`scripts/qa/storefront-db.mjs` proves against a real browser.

The 120 prerendered product pages are gone deliberately. They were correct when
the catalogue was a file compiled into the bundle; they are wrong when a price
corrected in the database would keep showing the build-time value until the next
deploy.

The cost is real — every page is a server render with round trips to Singapore.
Incremental regeneration with an explicit revalidation hook is the right
production refinement, but it needs an invalidation path that something actually
calls, and shipping a cache nobody knows how to clear would be worse than
rendering honestly.

One exception: `lib/suggest.ts` holds its corpus in process for 30 seconds.
The header fires a request per keystroke, and reading 120 projections from
Singapore each time cost ~400ms per character. Suggestions are typing hints and
the results page they lead to is always read live, so a few seconds of staleness
is the right trade there and nowhere else.

Because the root `not-found.tsx` reads best sellers from the database, Next
would otherwise pull a database call into the shell of every prerendered page.
Keeping those routes dynamic too preserves a property worth having: **`next
build` succeeds with no database at all.**

---

## 8. What is not in the database yet

Deliberately still client-side, in `localStorage` via Zustand:

- the cart
- orders and order history
- authentication
- checkout state

Two runtime references to the static catalogue remain, both deliberate:

**`lib/commerce.ts` → `lib/catalog.ts`.** `getCartIndex()` resolves cart lines
from the catalogue, synchronously. `lib/commerce.ts` is the authoritative source
of commerce calculations and is a protected file, and cart persistence belongs
to a later wave — so this stays. It means `data/catalog.json` is still in the
*server* bundle for routes that import commerce constants, including the
homepage and the product page. Neither reads product data through it: the
homepage takes the free-shipping threshold, the product page takes the buy box's
constants. `/s` and `/browse` have no path to the catalogue at all.

**`lib/search.ts`.** Superseded by `lib/data/search.ts` and no longer on any
storefront path. It is a protected file, so it is left exactly as it was; the
live URL contract moved to `lib/search-params.ts`, which carries compile-time
assertions against it so the two cannot drift apart silently.

The catalogue no longer reaches the browser at all. Before this stage a 318 KB
client chunk containing all 120 products shipped on every visit, because the
filter sheet and sort control imported values from `lib/search.ts`, which builds
a Fuse index over the catalogue at module scope.

---

## 9. Secrets

- `.env` and `.env.*` are git-ignored; `.env.example` is the only tracked
  template and contains placeholders.
- No connection string, password or certificate belongs in the repository.
- `prisma.config.ts` reads a URL from the environment and throws when it is
  missing. It has no fallback default on purpose — a silent default is how a
  migration ends up run against the wrong database.
