/**
 * The test-ID contract.
 *
 * QA scripts used to target CSS classes, which is why a visual change could
 * silently invalidate hundreds of assertions. This map is the agreed seam
 * between the UI and the suites: components render these values, scripts look
 * them up, and a future redesign edits one file instead of fifteen.
 *
 * Targeting preference, strongest first:
 *   1. ARIA role + accessible name  - works for anything with real semantics
 *   2. data-testid from this map    - for what has no distinguishing semantics
 *   3. stable text content          - last resort
 *   Never a CSS class.
 *
 * Most of the application is already reachable by role and accessible name, so
 * this map is deliberately small. An ID earns its place only where semantics
 * cannot distinguish an element - a product card among sixteen identical cards,
 * or a subtotal among several money figures on the page.
 *
 * Mirrored verbatim in scripts/qa/selectors.mjs, which the standalone Playwright
 * scripts import. The two must stay in step; `npm run typecheck` cannot catch a
 * drift between them, so the smoke suite asserts a sample of them at runtime.
 */
export const TID = {
  /* Product card - repeated identically across grids, so it needs an ID. */
  productCard: "product-card",
  productCardTitle: "product-card-title",
  productCardPrice: "product-card-price",

  /* Cart controls. The button itself is reachable by role+name; the stepper
     that replaces it once an item is in the cart is not. */
  addToCart: "add-to-cart",
  cartQtyStepper: "cart-qty-stepper",

  /* Mini-cart. The panel has role=dialog and a name, but its subtotal is one
     of several money figures on screen. */
  miniCart: "mini-cart",
  miniCartSubtotal: "mini-cart-subtotal",

  /* Cart and checkout money. Distinguishing a subtotal from a total from a
     line total is the assertion these exist for. */
  cartSubtotal: "cart-subtotal",
  orderTotal: "order-total",

  /* Search. The input is reachable by role; the overlay that will wrap it in
     wave 1 is not. */
  searchInput: "search-input",

  /* --- Reserved for later waves. Declared here so the contract is written
     down once; nothing renders these yet. ---------------------------------- */

  /** wave 1 - full-screen search overlay */
  searchOverlay: "search-overlay",
  /** wave 1 - mobile bottom tab bar */
  bottomTabs: "bottom-tabs",
  /** wave 1 - department popover in the header */
  browsePopover: "browse-popover",
  /** wave 2 - sticky facet bar above results */
  facetBar: "facet-bar",
  /** wave 2 - a facet dropdown chip in the facet bar */
  facetChip: "facet-chip",
  /** wave 2 - a removable applied-filter chip */
  activeFilterChip: "active-filter-chip",
  /** wave 2 - slide-over carrying the full facet set */
  filterSheet: "filter-sheet",
  /** wave 2 - grid/list density control */
  densityToggle: "density-toggle",
  /** wave 4 - sticky PDP decision card */
  pdpDecisionCard: "pdp-decision-card",
} as const;

export type TestId = (typeof TID)[keyof typeof TID];

/** Spreads a test id onto an element: `<div {...testId(TID.productCard)}>`. */
export function testId(id: TestId) {
  return { "data-testid": id };
}
