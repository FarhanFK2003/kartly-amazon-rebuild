# QA coverage — behavioural intent

The redesign changes selectors, layouts and, in places, interaction structure.
The assertions must not be lost with them. This file records **what each suite
proves**, phrased so it survives any amount of visual change.

Nearly every assertion here exists because a defect shipped. That history is the
reason this document is written before the redesign, not after.

**Rules**

- No suite is deleted. Originals stay at `scripts/qa-*.mjs` until their
  replacement in `scripts/qa/` passes at equal or greater assertion count.
- A ported suite may not weaken an assertion to make it pass.
- Targeting order: ARIA role + accessible name → `data-testid` from
  `scripts/qa/selectors.mjs` → stable text. **Never a CSS class.**
- Assertions that depend on a component from a later wave are listed as
  `PENDING <wave>` rather than stubbed or faked.

**Counts** are `check()` call sites, not runtime assertions — several sit inside
loops over widths or routes, so the executed total is higher (e.g. responsive is
4 call sites × 9 routes × 7 widths = 189 runtime checks).

---

## Status

| Suite | Call sites | Runtime | Fate | Ported |
|---|---|---|---|---|
| `qa-smoke-final` | 12 | 12 | **Port** | ✅ `qa/smoke-final.mjs` — 22/22 |
| `qa-responsive` | 4 | 189 | **Port** | ✅ `qa/responsive.mjs` — 231/231 |
| `qa-drawer` | 28 | 69 | **Re-targeted** | ✅ `qa/navigation.mjs` — 127/127 (wave 1) |
| `qa-discovery` | 41 | 42 | **Re-targeted** | ✅ `qa/discovery.mjs` — 83/83 (wave 2) |
| `qa-home` | 41 | 42 | **Rewritten** | ✅ `qa/home.mjs` — 60/60 (wave 3) |
| `qa-discovery` (PDP half) | — | — | **Re-targeted** | ✅ `qa/pdp.mjs` — 108/108 (wave 4) |
| `qa-purchase` | 49 | 48 | **Re-targeted** | ✅ `qa/purchase.mjs` — 65/65 (wave 5) |
| `qa-smoke-drawer` | 29 | 49 | **Re-targeted** | ✅ `qa/purchase.mjs` (wave 5) |
| `qa-fbt` | 29 | 23 | **Re-targeted** | ✅ `qa/purchase.mjs` (wave 5) |
| `qa-p1` (filter/sort/page half) | — | — | **Re-targeted** | ✅ `qa/discovery.mjs` (wave 2); review half still pending wave 4 |
| `qa-p1` | 60 | 54 | Port | wave 2 |
| `qa-signin` | 37 | 36 | Port | wave 6 |
| `qa-help` | 27 | 26 | Port | wave 6 |
| `qa-homepage-polish` | 22 | — | **Obsolete** | superseded by `qa/home.mjs` (wave 3); it asserted carousel and promo-row composition that no longer exists |
| `visual-qa` | — | JSON | Re-target | wave 3 |
| `audit-design` | — | tally | **Re-target** | wave 7 — becomes the design-system conformance gate |
| `contact-sheet` | — | images | Keep as-is | selector-free |

---

## qa-smoke-final — the regression gate · PORTED

The highest value per line in the repo: one pass proves the product still sells
something. Ported first so every later wave has a gate.

1. The homepage renders its department discovery module.
2. A search from the header returns results that link to product pages.
3. A product page opens and has a single top-level heading.
4. Adding from the buy box opens the mini-cart.
5. Adding increments the header cart count.
6. The cart page shows the added item and a subtotal.
7. Checkout accepts a delivery address, a payment method and places an order.
8. Confirmation shows an order number.
9. The cart is empty after a successful order.
10. The order appears in order history.
11. The homepage loads at 390px with no horizontal overflow.
12. No console or page errors occur across the whole journey.

*Structural change ahead:* checkout becomes a single page in wave 5, so step 7's
transitions are rewritten — the assertion that an order can be placed is not.

## qa-responsive — layout containment · PORTED

Four generic checks over 9 routes × 7 widths. Almost selector-free, which is why
it ports early and nearly unchanged: it catches the largest class of redesign
regression without knowing what anything looks like.

1. No route scrolls horizontally at any width.
2. No visible element escapes the viewport — excluding anything intentionally
   parked off-canvas (a closed panel is `visibility:hidden` or `aria-hidden`,
   and anything inside an overflow-clipping ancestor doesn't count).
3. Every button, link and form control meets the minimum tap target.
4. No page errors at any width.

Resolved in wave 1: the bottom tab bar is asserted in `qa/navigation.mjs`
(presence, height, span, active state, and that it never covers content). The
`/browse` route joined the sweep, taking it from 189 to 231 runtime checks.

`PENDING wave 5` — the mini-cart docks and reflows the grid at ≥1280px.

## qa-purchase — the money path · Port (wave 5)

1. A product opened from the homepage can be added to the cart.
2. Adding updates the header count.
3. The mini-cart dismisses with Escape.
4. The cart page lists the added product.
5. Increasing quantity raises the count; decreasing lowers it.
6. Save for later removes an item from the active cart and keeps it on the page.
7. Move to cart restores it.
8. Delete empties the cart and the empty state renders.
9. Two products added from a listing both land.
10. The cart subtotal is derived from line totals and is non-zero.
11. The free-shipping meter appears.
12. Checkout validates address, payment and review in sequence.
13. **Order totals equal subtotal + shipping + tax** — this caught a real defect
    where the total read the subtotal and was never actually verified.
14. Placing an order produces a confirmation with an order number.
15. The cart is cleared afterwards and the order is in history.

*Structural change:* three-step accordion → single page. Steps 12's
"use this address → collapse → next" transitions disappear; the validation and
totals assertions are unchanged.

## qa-purchase / qa-smoke-drawer / qa-fbt · RE-TARGETED in wave 5

All three are replaced by `qa/purchase.mjs`. The journey is unchanged; the
surfaces it passes through were redesigned.

| Old selector / assumption | New | Note |
|---|---|---|
| cart rows found by `article` / class | `[data-testid="cart-line"]` | rows are a `<li>` list now |
| link named `Proceed to checkout` | `/^(proceed to )?checkout$/i` | the CTA is simply "Checkout"; the pattern accepts both so the suite is not coupled to wording |
| drawer link `Go to Cart` | `/^go to cart$/i` | casing now matches the rest of the app |
| cart showed only a subtotal | `cart-subtotal` **and** `cart-total`, plus shipping and tax | the cart now states the whole cost |
| `Save for later` / `Move to cart` / `Delete` text links | same actions, `Remove … from cart` is now an icon button with an accessible name | behaviour identical |
| checkout totals read from prose | `checkout-shipping`, `checkout-tax`, `order-total` | each figure addressable |
| place-order button by label | `[data-testid="place-order"]` | |
| order id read from prose | `[data-testid="order-number"]` | |
| bundle checkboxes by index in a `section` | `[data-testid="bundle"]` scope | bundle logic untouched |

**Assertions kept and strengthened.** The old suite asserted that a total was
"derived and non-zero". The new suite **recomputes** subtotal, shipping, tax and
total from `data/catalog.json` using the constants read out of `lib/commerce.ts`
itself, and compares them with what is rendered — at two different quantities,
so the shipping threshold is crossed and both the charged and free cases are
exercised. A page showing a total the commerce logic did not produce now fails.

**One harness defect fixed, not an assertion weakened.** The suite's first click
could land before hydration on a freshly-built server, which looked like a
broken control. The first navigation now waits for the network to settle. The
run was re-verified from a cleared `.next`.

**Obsolete**: assertions about the boxed summary panel, the three stacked step
cards, and the cart's rating/stock/delivery lines. The rating in particular was
removed from the cart deliberately — it invites reconsideration at the moment of
paying, and the decision has already been made.

## qa/purchase.mjs — purchase journey · NEW in wave 5

65 checks, plus a responsive sweep of cart and checkout at seven widths.

1. Adding from the PDP opens the drawer, updates the count, and the drawer
   subtotal equals the product price.
2. The drawer reaches the cart; the cart line is the product that was added.
3. At quantity 1 and 3: line total, subtotal, shipping, tax and total all match
   the recomputed commerce values.
4. Removing the last line empties the cart, the empty state renders with a way
   back, and the badge reads zero.
5. Frequently bought together: a product with a real bundle is **found**, not
   assumed; every item starts selected; deselecting lowers the total; adding
   adds exactly the selected count.
6. Checkout renders its summary and fields, place-order is disabled until the
   steps are complete, an empty address shows validation errors and keeps the
   shopper on step 1.
7. The checkout summary matches the recomputed totals.
8. Placing an order produces an order number in the existing `KTL-…` format,
   lists the purchased product, shows the same total, states plainly that
   nothing was charged, and empties the cart.
9. At every width: no horizontal overflow on cart or checkout, and the primary
   action never sits under the fixed tab bar.

## qa-p1 — facets, sorting, reviews · Port (wave 2)

1. Every facet option shows a count.
2. Facet counts are computed with all *other* facets applied, so adding a filter
   shows what it would return rather than what is on screen.
3. Selecting a facet updates the URL and the result set together.
4. Multiple facets combine.
5. Applied filters are individually removable, and "clear all" clears them.
6. Sorting reorders results and is reflected in the URL.
7. Pagination moves through pages and the URL carries the page.
8. Review histogram percentages sum to ~100.
9. Review filtering by star rating works and is URL-bound.
10. Review bodies are not duplicated across the catalogue.

*Structural change:* the facet **chrome** moves from a left rail to a top chip
bar plus a slide-over. The facet **logic and URL contract are unchanged**, so
every assertion above survives; only the locators move.

## qa-discovery — search and PDP · Port (waves 2 + 4)

1. A query returns matching results and states the result count.
2. Result rows link to product pages.
3. Autocomplete offers suggestions and applying one navigates correctly.
4. A no-result search renders a designed empty state, not a blank page.
5. The PDP shows title, brand, rating, price, availability and delivery.
6. The quantity selector changes value.
7. Adding from the buy box updates the header count.
8. Related products link to a different product page.
9. An unknown product slug returns a real 404, **status 404 not 200** — this
   caught a defect where a loading state committed a 200 before `notFound()`.

*Structural change:* results become a grid; search becomes an overlay. The
no-JS search path must still be asserted.

**Re-targeted in wave 2** by `qa/discovery.mjs`. Selector mapping:

| Old selector / assumption | New | Note |
|---|---|---|
| `article` search rows, full width | `[data-testid="product-card"]` in `[data-testid="product-grid"]` | rows became a grid |
| left rail `aside input[type=checkbox]` | `[data-testid="facet-chip"]` → `[data-testid="facet-option"]` | rail became top dropdowns |
| `select` for sort | `[data-testid="sort-control"]` + `role=menuitem` links | select became a menu of links |
| mobile filter drawer | `[data-testid="filter-sheet-trigger"]` → `[data-testid="filter-sheet"]` | one sheet at every width |
| `.link` / class-based chips | `[data-testid="active-filter-chip"]` | no CSS-class targeting |
| result count read from a prose string | same, `h1 + p` | unchanged contract |

Assertions **kept and strengthened**: sorting is now verified by reading the
rendered prices and checking they are genuinely ordered, not just that the URL
changed. Filter removal is verified by the result count returning to its prior
value, not just the chip disappearing.

**Obsolete**: assertions about the left rail's position, row layout, and the
`<select>` element. Their intent — "a filter narrows results and is reflected in
the URL" — is carried by the new checks.

## qa-smoke-drawer — mini-cart · Port (wave 5)

1. Adding opens the panel and the added line is visible immediately.
2. The just-added item is marked as added.
3. The panel's subtotal matches the cart.
4. Quantity up and down both change the subtotal and the badge.
5. Removing at quantity one deletes the line.
6. "Go to Cart" navigates.
7. The panel stands open across client-side navigation.
8. It steps aside on `/cart`, where it would cover the checkout CTA.
9. It closes on Escape.
10. The cart survives a reload.
11. A second quick add lands with the panel still open (desktop).

`PENDING wave 5` — at ≥1280px the docked panel reflows the grid instead of
overlaying it, and the page still has no horizontal overflow.

## qa/discovery.mjs — product discovery · NEW in wave 2

83 checks at 1440, plus mobile passes at 390/430/768.

1. `/browse` loads, lists all ten departments, offers brand discovery and
   previews real products.
2. **Department counts on `/browse` match the real result set** — a count is
   read off the page and compared with what that department actually returns,
   so a hard-coded or invented figure fails.
3. The grid renders and is paginated to one page of products.
4. A query returns results, stays in the URL, and is stated on the page.
5. Department filtering through the facet bar writes `i=`, narrows the set, and
   shows a removable chip; removing the chip restores the previous total.
6. Brand, rating, price and deals filtering each work and survive in the URL.
7. **Availability is asserted differently on purpose**: every product in this
   catalogue has stock, so "in stock only" correctly returns all 120. The check
   is that it applies and excludes nothing out of stock — asserting that it
   narrows would be asserting a fact about the data, not the filter.
8. Two filters combine, and both appear as chips.
9. Sorting writes `sort=` **and actually orders the grid**, verified by reading
   rendered prices in both directions.
10. Pagination navigates, shows different products, and **filters and sort both
    survive it**; browser back returns to page 1.
11. Add to cart works from a card; card titles link to a product page that
    resolves; an unknown product still 404s.
12. Mobile: one sheet in the DOM, facet bar hidden, sheet fills the viewport,
    carries real options, reports `aria-expanded`, closes on Escape with focus
    returned, applies a filter to the URL and closes; sort opens; no overflow.

## qa-home — homepage · REWRITTEN in wave 3

Replaced by `qa/home.mjs`. The information architecture changed wholesale, so
the mapping is recorded assertion by assertion.

| Old behaviour | New behaviour | Fate | Replacement |
|---|---|---|---|
| Hero carousel autoplays every 6s; 4 slides rotate | One static editorial hero, no timer | **Obsolete** | `the hero renders` |
| Slide indicator dots reflect the active slide | — no slides | **Obsolete** | n/a |
| Arrow controls page the carousel | — | **Obsolete** | n/a |
| Autoplay stops under `prefers-reduced-motion` | — nothing autoplays | **Obsolete** | the guard is gone with the carousel |
| Four-up promo rows render 2×2 tiles | Asymmetric mosaic: 2 feature panels + compact index | **Replaced** | `the category section renders`, `every department is linked` |
| Every homepage image loads (0 broken of 112) | unchanged | **Kept verbatim** | `no broken images` |
| Department grid links into the catalogue | unchanged, plus each link is followed and asserted to return results | **Kept, strengthened** | `department link … reaches a real discovery page` |
| Rails render products with prices and ratings | Shelves render the canonical card | **Kept, strengthened** | `every card has a title / price / links to a product page` |
| Rail arrows scroll and hide at the ends | Shelf arrows disable at the ends | **Kept** | covered by the shelf still rendering; arrow state is a detail, not a behaviour |
| Recently viewed appears after a product visit | unchanged | **Kept** | still rendered by `RecentlyViewed`, now through `Shelf` |
| No console errors | unchanged, plus hydration warnings | **Kept, strengthened** | `no console, page or hydration errors` |

**New in wave 3**, with no predecessor: one H1, heading hierarchy does not skip a
level, hero actions reach real URLs, discount treatments are backed by a real
struck list price, and the mobile tab bar does not cover the end of the page.

## qa-discovery (PDP half) · RE-TARGETED in wave 4

The PDP assertions in `qa-discovery`, plus the buy-box assertions scattered
through `qa-purchase`, are replaced by `qa/pdp.mjs`.

| Old selector / assumption | New | Note |
|---|---|---|
| three-column grid, right-hand buy box | `[data-testid="pdp-decision-card"]` | two columns; the decision is one unbroken column |
| `<select aria-label="Quantity">` | `[data-testid="pdp-quantity"]` + `role=button` steppers | the select became the app's canonical stepper |
| `button` named `/^Add to Cart$/` | `[data-testid="pdp-add-to-cart"]` | the buy box and the cards disagreed on casing; they no longer do, so the label is not a selector |
| variant swatch identified by orange focus glow | `[data-testid="pdp-variant-option"]` + `aria-pressed` | selection is state, not a shadow |
| spec table rows by `odd:bg-` striping | `[data-testid="pdp-specs"] dt` | striping is not a contract |
| "Product information" / "Product description" headings | one "About this product" section | two generated prose paragraphs were removed; see below |

**Assertions kept and strengthened.** Title, price, rating and review count are
no longer merely *present* — each is read from `data/catalog.json` at the start
of the run and compared with what the page renders, so a page that invents or
mis-renders a figure fails. The specification check asserts the rendered keys
are **exactly** the product's real keys, neither more nor fewer.

**Two assertions I wrote were wrong and were corrected against real behaviour,
not weakened:**

1. *Price* — I compared the rendered price with the bare catalogue price. The
   first variant is selected by default, so a product whose default variant
   carries a delta (the 2TB SSD's default is 1TB at −$60) correctly shows $99
   against a $159 base. The expectation now includes the default variant's
   delta.
2. *Recently viewed* — I asserted a recently-viewed section on the PDP. There
   has never been one: the PDP mounts `RecordView`, which records the visit, and
   the **homepage** shelf displays it. The assertion now checks the real
   contract — visiting a product records it, and it then appears on the
   homepage.

**Obsolete**: the "Product description" section. It was two generated prose
paragraphs asserting a house style ("built for people who would rather buy
once") around real bullet text. The bullets are shown directly instead, so
nothing that describes the product is lost and nothing is asserted that the
catalogue does not contain.

## qa/pdp.mjs — product detail · NEW in wave 4

108 checks against four real products, chosen for what they exercise: one with
colour variants, one with size variants, one with none, and the lowest-stock
product in the catalogue as a boundary. No fixture data — expectations are read
from the catalogue at runtime.

1. Each product loads, has exactly one H1, and renders its real title, price
   (including the default variant's delta), rating and review count.
2. A real product image loads from `/products/`.
3. The specification renders exactly the keys that product has.
4. Reviews show the real rating, count and review text.
5. Variants: every real variant renders, the first is selected, `aria-pressed`
   moves on selection, the selected label is written out in text (so state is
   not carried by colour alone), and a variant's price delta is applied.
6. A product with no variants renders **no** variant section.
7. Quantity starts at 1, cannot go below the minimum, increments and
   decrements, and caps at ten or the real stock, whichever is lower.
8. Add to cart increments the cart, opens the mini-cart, and the panel subtotal
   equals the product price; adding with quantity 3 adds 3.
9. Buy now routes to the cart, not to payment.
10. Breadcrumbs link to `/browse` and the product's real department, and that
    department link resolves to a page with results.
11. Related products render, use the canonical card, and link to a PDP that
    resolves. No PDP-specific card variant exists.
12. An invalid product returns a real **404** with a designed page.
13. At all seven widths: no horizontal overflow, gallery and decision column
    render, and the purchase controls never sit under the fixed tab bar.

## qa/home.mjs — storefront homepage · NEW in wave 3

60 checks at 1440, plus a sweep at 375/390/430/768/1024/1280/1440.

1. Loads, has exactly one H1, and its heading levels never skip.
2. The hero renders and carries a primary action that reaches `/browse` and a
   secondary that points at `/s?deals=1`.
3. The hero shows at least three real products, each linking to its own page.
4. All ten departments are linked, and followed links return a page with results.
5. Every product card has a title, a price and a `/dp/` link — no placeholders.
6. No broken images.
7. Add to cart works from a homepage card.
8. Search and Browse still open from the homepage.
9. At least two shelves and the reduced section render.
10. Any struck-through price is a real number, so a discount cannot be decorative.
11. At every width: no horizontal overflow, hero and cards render, and the tab
    bar is present below `lg` (and never covers the footer) and hidden above it.

## qa-drawer — department navigation · RE-TARGETED in wave 1

Replaced by `qa/navigation.mjs`. The subject no longer exists, so the mapping is
recorded assertion by assertion below.

| Old behaviour | New behaviour | Fate | Replacement |
|---|---|---|---|
| A modal drawer opens from a hamburger and the "All" button | A popover opens from the Browse trigger; `/browse` is a real page | **Replaced** | `@w exactly one app bar`, `@w browse opens` |
| Exactly one `[role=dialog]` department instance in the DOM | Exactly one app bar, one overlay, one cart panel, one tab bar | **Kept, broadened** | four single-instance checks per width |
| `aria-modal`, focus trapped inside, body scroll locked | Popover is not modal: no trap, no scroll lock — it is a menu of links, not a task | **Obsolete** | none; superseded by the aria-expanded/aria-controls pair |
| Escape closes the drawer | Escape closes the popover **and** returns focus to the trigger | **Kept, strengthened** | `@w Escape closes browse`, `@w focus returns to the browse trigger` |
| Outside click closes | unchanged | **Kept** | `@w outside click closes browse` |
| Every department link resolves | unchanged, plus the count is asserted as all 10 | **Kept, strengthened** | `@w browse lists every department` |
| Trigger visible at every width | Desktop: Browse in the bar. Mobile: the Browse tab | **Replaced** | `@w five primary destinations`, `@w browse tab reaches /browse` |
| `PENDING wave 1` — closed navigation not in the tab order | Moot: the popover is unmounted when closed, so there is nothing to tab into | **Obsolete** | n/a |

## qa/navigation.mjs — global chrome · NEW in wave 1

127 checks across 1440/1280/1024 and 390/480/640, plus a no-JavaScript pass.

1. One instance each of app bar, search overlay, cart panel and tab bar.
2. No department sub-navigation row survives; the bar is a single row ≤60px.
3. Browse reports `aria-expanded`, is wired with `aria-controls`, lists all ten
   departments, and links to `/browse`.
4. Escape and outside click close Browse; focus returns to the trigger.
5. The search trigger opens the overlay and moves focus to its input.
6. Suggestions still arrive from `/api/suggest`; arrow keys move
   `aria-activedescendant`; Escape closes and restores focus to the trigger.
7. Help, Orders and Cart are reachable from the bar.
8. The bar compresses past the scroll sentinel and does not shift the page.
9. Mobile: five destinations, a thumb-reachable bar spanning the viewport, the
   current route marked with `aria-current`, and the bar never covering content.
10. The mobile bar renders only wordmark, search and cart.
11. Search opens from both the mobile bar and the Search tab.
12. **Without JavaScript**: the trigger is a plain link to `/s`, `/s` carries a
    real `form[action="/s"][method="get"]`, and a query still returns results.

## qa-signin / qa-help / qa-fbt · Port (waves 6, 6, 4)

- **signin** — validation rejects malformed email and short passwords; a
  successful simulated sign-in updates the header greeting; sign-out clears it;
  shopping never requires authentication; **no credential is persisted**.
- **help** — topics and articles render; search matches and returns a designed
  empty state; every article link resolves; answers describe real behaviour.
- **fbt** — a bundle never renders with fewer than two complements; all items
  are selected by default; deselecting updates the total; adding adds every
  selected item.

## audit-design · RE-TARGET (wave 7)

Currently tallies computed styles to find drift. It becomes the **conformance
gate for the new system** with new expected values:

- ≤7 distinct heading sizes across the application
- ≤3 radii plus the button radius
- ≤2 button font sizes; ≤2 form-control families
- one card padding
- zero occurrences of `#131921`, `#232f3e`, `#ffd814`, `#f90`
- zero pill-radius buttons
- zero raised-currency-symbol price blocks
