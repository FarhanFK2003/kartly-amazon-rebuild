# Kartly

A marketplace storefront built from scratch for a 24-hour product rebuild exercise. It reproduces
the information architecture and interaction quality of a large online marketplace — search,
product detail, cart, checkout — under its own branding.

**Kartly is a demo. Nothing here is for sale, no payment is ever processed, and it is not
affiliated with or endorsed by Amazon.com, Inc. All brand and product names in the catalogue are
fictional.**

---

## ⚠️ The order flow is simulated

This is the most important thing to know before clicking through the site.

- **No payment is processed.** There is no payment provider, no API key, no charge.
- **No card details are collected, transmitted or stored.** The card form is validated locally
  (length, Luhn checksum, expiry) purely so the form behaves believably. The card number is never
  persisted — only the last four digits are kept, on the order record, to render "ending in 4242".
  Use `4242 4242 4242 4242` to try it.
- **"Place your order" creates a local record only.** It generates an order id, writes the order to
  `localStorage`, empties the cart and shows a confirmation page. Nothing is sent anywhere and
  nothing will ever ship.
- Every order is stored with a `simulated: true` flag, and the confirmation page says so on screen.

## Signed out by design

There is no authentication and no database. The whole store works as a guest:

- **Cart** lives in `localStorage` (`kartly.cart`)
- **Checkout progress** lives in `localStorage` (`kartly.checkout`) so a refresh mid-flow doesn't
  lose your address
- **Completed orders** live in `localStorage` (`kartly.orders`)

That means state is per-browser and per-device. Clearing site data clears your cart and order
history, and an order confirmation link won't open on another machine.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
```

> On Windows, `localhost` may resolve to IPv6 while the server binds IPv4. Use `127.0.0.1:3000`.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| Styling | Tailwind CSS v4, design tokens in `app/globals.css` |
| State | Zustand + `localStorage` persistence |
| Search | Fuse.js fuzzy matching over a static catalogue |
| Data | 120 products, 10 departments, 672 reviews — no database |

## Catalogue

The catalogue is generated deterministically from seeds, so rebuilding produces an identical file:

```bash
npm run catalog      # regenerate data/catalog.json from scripts/product-seeds.mjs
npm run images       # download any missing product imagery (idempotent)
```

Ratings, review counts, deals, stock and delivery windows are derived from a PRNG seeded on each
product id. Rating histograms are solved so the bars always agree with the headline star value.

**Imagery** is sourced from [Openverse](https://openverse.org), filtered to CC0 / Public Domain
Mark, downloaded at build time and committed — the deployed site makes no runtime request to any
third-party image host. See [ATTRIBUTION.md](ATTRIBUTION.md). Because openly-licensed pools contain
little true product photography, some images are only loosely related to the product they
illustrate. This is a known, accepted tradeoff for this exercise.

## Routes

| Route | What |
|---|---|
| `/` | Home — departments, best sellers, deals |
| `/s?q=` | Search and browse, with filters, sort and pagination |
| `/dp/[id]` | Product detail (accepts slug or short id) |
| `/cart` | Cart, save for later, free-shipping meter |
| `/checkout` | Three-step simulated checkout, stripped header |
| `/order-confirmation/[orderId]` | Order confirmation |

## Testing

QA is done by driving a real browser against the **production** build, not by asserting on markup:

```bash
npm run build && npm run start
node scripts/visual-qa.mjs   out/   # chrome, responsive, back-to-top
node scripts/qa-discovery.mjs out/   # search -> result -> PDP
node scripts/qa-purchase.mjs  out/   # cart -> checkout -> confirmation
```

Each script captures screenshots, records console/page errors and unexpected 404s, and fails on
real problems. Routes that are intentionally not built yet are reported separately so they can't
mask regressions.

## Agent logs

`.agent-logs/` contains the automatic capture of every prompt and final response used to build
this, committed alongside the code it produced. See [CAPTURE-TEST.md](CAPTURE-TEST.md).
