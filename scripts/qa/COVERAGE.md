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
| `qa-smoke-final` | 12 | 12 | **Port** | ✅ `qa/smoke-final.mjs` |
| `qa-responsive` | 4 | 189 | **Port** | ✅ `qa/responsive.mjs` |
| `qa-purchase` | 49 | 48 | Port | wave 5 |
| `qa-p1` | 60 | 54 | Port | wave 2 |
| `qa-discovery` | 41 | 42 | Port | waves 2 + 4 |
| `qa-smoke-drawer` | 29 | 49 | Port | wave 5 |
| `qa-home` | 41 | 42 | **Rewrite** | wave 3 |
| `qa-drawer` | 28 | 69 | **Re-target** | wave 1 |
| `qa-signin` | 37 | 36 | Port | wave 6 |
| `qa-help` | 27 | 26 | Port | wave 6 |
| `qa-fbt` | 29 | 23 | Port | wave 4 |
| `qa-homepage-polish` | 22 | — | Re-target | wave 3 |
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

`PENDING wave 1` — bottom tab bar present and above the fold at ≤480px; sticky
bottom bars respect `env(safe-area-inset-bottom)` and do not overlap each other.

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

## qa-home — homepage · REWRITE (wave 3)

The information architecture changes wholesale, so most locators die. These
survive as behavioural statements:

1. Every homepage image loads — **0 broken of 112**. Ports verbatim.
2. Department discovery links into the catalogue.
3. Product shelves render real catalogue products with prices and ratings.
4. Shelf horizontal scrolling works and controls are reachable.
5. Recently viewed appears after visiting a product.
6. No console errors.

Retired with the components they test: hero carousel autoplay, slide indicators,
arrow controls, four-up promo row composition.

## qa-drawer — department navigation · RE-TARGET (wave 1)

The modal drawer becomes `/browse` plus a header popover. The single-instance
guarantee is the assertion worth keeping — it caught a real duplicate-DOM bug.

1. Exactly one department navigation instance exists in the DOM at any width.
2. Exactly one mini-cart instance exists.
3. Opening is possible at every width from a visible trigger.
4. Escape and outside click dismiss.
5. Focus returns to the trigger on close.
6. Every department link resolves to a real page — no dead links.
7. Navigating closes it.

*Structural change:* modal semantics become popover semantics; `aria-modal` and
the focus trap no longer apply. `PENDING wave 1` — closed navigation is not in
the tab order.

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
