/**
 * QA-side mirror of lib/testids.ts, plus the shared locator helpers.
 *
 * Standalone Playwright scripts cannot import the TypeScript contract, so this
 * file restates it. The smoke suite asserts a sample of these against the live
 * DOM, which is what catches a drift between the two.
 *
 * Helpers below encode the targeting preference: reach for a role and an
 * accessible name first, fall back to a test id, and never use a CSS class.
 */

export const TID = {
  productCard: "product-card",
  productCardTitle: "product-card-title",
  productCardPrice: "product-card-price",

  addToCart: "add-to-cart",
  cartQtyStepper: "cart-qty-stepper",

  miniCart: "mini-cart",
  miniCartSubtotal: "mini-cart-subtotal",

  cartSubtotal: "cart-subtotal",
  orderTotal: "order-total",

  searchInput: "search-input",
  searchTrigger: "search-trigger",
  searchOverlay: "search-overlay",

  appBar: "app-bar",
  bottomTabs: "bottom-tabs",
  browseTrigger: "browse-trigger",
  browsePopover: "browse-popover",
  accountArea: "account-area",
  cartLink: "cart-link",

  productGrid: "product-grid",
  facetBar: "facet-bar",
  facetChip: "facet-chip",
  facetOption: "facet-option",
  activeFilterChip: "active-filter-chip",
  filterSheet: "filter-sheet",
  filterSheetTrigger: "filter-sheet-trigger",
  sortControl: "sort-control",
  pagination: "pagination",

  hero: "hero",
  categorySection: "category-section",
  reducedSection: "reduced-section",
  shelf: "shelf",

  pdpTitle: "pdp-title",
  pdpDecisionCard: "pdp-decision-card",
  pdpPrice: "pdp-price",
  pdpQuantity: "pdp-quantity",
  pdpAddToCart: "pdp-add-to-cart",
  pdpVariants: "pdp-variants",
  pdpVariantOption: "pdp-variant-option",
  pdpSpecs: "pdp-specs",
  pdpReviews: "pdp-reviews",
  pdpGallery: "pdp-gallery",
  pdpGalleryThumb: "pdp-gallery-thumb",

  cartLine: "cart-line",
  cartLineTitle: "cart-line-title",
  cartLineQuantity: "cart-line-quantity",
  cartLineTotal: "cart-line-total",
  cartTotal: "cart-total",
  checkoutSummary: "checkout-summary",
  checkoutShipping: "checkout-shipping",
  checkoutTax: "checkout-tax",
  placeOrder: "place-order",
  orderConfirmation: "order-confirmation",
  orderNumber: "order-number",
  bundle: "bundle",
  bundleItem: "bundle-item",

  /* reserved for later waves - nothing renders these yet */
  pdpDecisionCard: "pdp-decision-card",
};

/** IDs that must be present in the running app today. The rest are reserved. */
export const LIVE_TIDS = [
  TID.productCard,
  TID.productCardTitle,
  TID.productCardPrice,
  TID.addToCart,
  TID.miniCart,
  TID.miniCartSubtotal,
  TID.searchInput,
  TID.searchTrigger,
  TID.searchOverlay,
  TID.appBar,
  TID.bottomTabs,
  TID.browseTrigger,
  TID.cartLink,
  TID.productGrid,
  TID.sortControl,
  TID.filterSheetTrigger,
  TID.pagination,
  TID.hero,
  TID.categorySection,
  TID.shelf,
  TID.placeOrder,
];

export const byTestId = (page, id) => page.locator(`[data-testid="${id}"]`);

/* ---------------------------------------------------------------- semantics */
/* Preferred: everything below is reachable by role and accessible name, so it
   survives any amount of visual change. */

export const cartLink = (page) => page.locator("a[aria-label^='Cart,']").first();
export const miniCart = (page) => page.getByRole("dialog", { name: "Shopping cart" });
export const goToCart = (page) => page.getByRole("link", { name: /^Go to cart$/i });
export const addToCartCta = (page) => page.getByRole("button", { name: /^Add to cart$/i });
/* The PDP's add-to-cart, by id rather than label: the buy box and the product
   cards used to disagree on casing ("Add to Cart" vs "Add to cart") and now do
   not, so targeting the label would have coupled the suite to that detail. */
export const buyBoxAddToCart = (page) => byTestId(page, TID.pdpAddToCart);
/* The cart's checkout CTA. It was "Proceed to checkout" and is now simply
   "Checkout", matching the page it leads to; the pattern accepts both so the
   suite is not coupled to the wording. */
export const proceedToCheckout = (page) =>
  page.getByRole("link", { name: /^(proceed to )?checkout$/i });
export const placeOrder = (page) => page.getByRole("button", { name: /Place your order/i });
/* The overlay's input implements the combobox pattern, so its explicit
   role=combobox overrides the implicit searchbox role of <input type=search>. */
export const searchBox = (page) => page.getByRole("combobox", { name: /Search Kartly/i }).first();
export const searchTrigger = (page) => page.getByRole("link", { name: "Search products" }).first();
export const searchOverlay = (page) => page.getByRole("dialog", { name: "Search products" });
export const browseTrigger = (page) => page.getByRole("button", { name: "Browse" }).first();
export const bottomTabs = (page) => page.getByRole("navigation", { name: "Primary" });
export const homeLink = (page) => page.getByRole("link", { name: "Kartly home" }).first();

/** Reads the integer out of the header cart button's accessible name. */
export async function cartCount(page) {
  const label = (await cartLink(page).getAttribute("aria-label")) || "";
  const m = /Cart,\s*(\d+)/.exec(label);
  return m ? Number(m[1]) : null;
}

/** Money as a number, from any element whose text contains a currency figure. */
export function money(text) {
  const m = /([\d,]+\.\d{2})/.exec(String(text ?? ""));
  return m ? Number(m[1].replace(/,/g, "")) : NaN;
}

/* --------------------------------------------------------------- the routes */

export const ROUTES = {
  home: "/",
  search: "/s?q=laptop",
  browseCategory: "/s?i=home-kitchen",
  filtered: "/s?i=electronics&sort=price-asc",
  pdp: "/dp/nordvik-field-4k-action-camera-electronics-03",
  cart: "/cart",
  orders: "/orders",
  help: "/help",
  signin: "/signin",
  browse: "/browse",
  notFound: "/no-such-page-exists",
};

/** The widths the responsive suite sweeps. */
export const WIDTHS = [1440, 1280, 1024, 768, 480, 390, 375];
