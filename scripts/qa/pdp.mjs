/**
 * Product detail page.
 *
 * Replaces the PDP half of scripts/qa-discovery.mjs and the buy-box assertions
 * scattered through qa-purchase. See COVERAGE.md for the mapping.
 *
 * Runs against four real products chosen for what they exercise, not for
 * convenience. Nothing here is fixture data - every expected value is read
 * from data/catalog.json at the start of the run and compared against what the
 * page renders, so a page that invents a price or a rating fails.
 *
 *   node scripts/qa/pdp.mjs <output-dir>
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { TID, byTestId, cartCount, miniCart } from "./selectors.mjs";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const catalog = JSON.parse(fs.readFileSync("data/catalog.json", "utf8"));
const bySlug = (slug) => catalog.products.find((p) => p.slug === slug);

/* Representative products, picked from the real catalogue. */
const COLOUR = bySlug("aureon-halo-pro-wireless-over-ear-headphones-electronics-01"); // colour variants
const SIZED = bySlug("nordvik-vault-2tb-portable-ssd-computers-07"); // size variants
const PLAIN = bySlug("nordvik-field-4k-action-camera-electronics-03"); // no variants
const SCARCE = catalog.products.filter((p) => p.stock > 0).sort((a, b) => a.stock - b.stock)[0]; // boundary: lowest stock

const problems = [];
let total = 0;
const check = (name, passed, detail = "") => {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
};
const settle = (page, ms = 600) => page.waitForTimeout(ms);
const money = (t) => {
  const m = /([\d,]+\.\d{2})/.exec(String(t ?? ""));
  return m ? Number(m[1].replace(/,/g, "")) : NaN;
};

const browser = await chromium.launch();
const errors = [];
const badResponses = [];
let expecting404 = false;

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`));
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|did not match|Text content does not match/i.test(t)) errors.push(`HYDRATION: ${t.slice(0, 160)}`);
  if (m.type() !== "error") return;
  if (/DevTools|preloaded using link preload/.test(t)) return;
  if (expecting404 && /Failed to load resource/.test(t)) return;
  errors.push(t.slice(0, 140));
});
page.on("response", (r) => {
  if (r.status() === 404 && !expecting404) badResponses.push(r.url().slice(0, 90));
});

/* ================= 1-6. the page renders real product data ============== */
for (const product of [COLOUR, SIZED, PLAIN, SCARCE]) {
  const label = product.id;
  const res = await page.goto(`${BASE}/dp/${product.slug}`, { waitUntil: "domcontentloaded" });
  await settle(page, 800);

  check(`${label} loads`, res.status() === 200, String(res.status()));
  check(`${label} has exactly one H1`, (await page.getByRole("heading", { level: 1 }).count()) === 1);

  /* Title, price and rating must match the catalogue exactly. */
  const title = (await byTestId(page, TID.pdpTitle).innerText()).trim();
  check(`${label} renders the catalogue title`, title === product.title, `${title.slice(0, 40)}…`);

  /* The first variant is selected by default, so the price shown is the base
     price plus that variant's delta - not the bare base price. */
  const expectedPrice = (product.price + (product.variants[0]?.priceDelta ?? 0)) / 100;
  const shownPrice = money(await byTestId(page, TID.pdpPrice).innerText());
  check(`${label} renders the catalogue price for the default variant`,
    shownPrice === expectedPrice, `${shownPrice} vs ${expectedPrice}`);

  const decision = await byTestId(page, TID.pdpDecisionCard).innerText();
  check(`${label} renders the catalogue rating`, decision.includes(product.rating.toFixed(1)),
    product.rating.toFixed(1));
  check(`${label} renders the catalogue review count`,
    decision.includes(product.reviewCount.toLocaleString("en-US")),
    product.reviewCount.toLocaleString("en-US"));

  /* A real product image, not a placeholder. */
  const img = await page.evaluate((tid) => {
    const el = document.querySelector(`[data-testid="${tid}"] img`);
    return el ? { src: el.currentSrc || el.src, ok: el.complete && el.naturalWidth > 0 } : null;
  }, TID.pdpGallery);
  check(`${label} shows a real product image`, !!img && img.ok && /\/products\//.test(decodeURIComponent(img.src)),
    img ? img.src.slice(0, 60) : "none");

  /* 15. specification renders only the keys this product actually has. */
  const specKeys = await page.evaluate(
    (tid) => [...document.querySelectorAll(`[data-testid="${tid}"] dt`)].map((d) => d.textContent.trim()),
    TID.pdpSpecs
  );
  const realKeys = Object.keys(product.specs);
  check(`${label} renders exactly its real specification keys`,
    specKeys.length === realKeys.length && realKeys.every((k) => specKeys.includes(k)),
    `${specKeys.length} vs ${realKeys.length}`);

  /* 16. reviews render from real data. */
  const reviewsText = await byTestId(page, TID.pdpReviews).innerText();
  check(`${label} review section shows the real rating`, reviewsText.includes(product.rating.toFixed(1)));
  check(`${label} review section shows the real count`,
    reviewsText.includes(product.reviewCount.toLocaleString("en-US")));
  const firstReview = product.reviews[0];
  check(`${label} renders a real review body`,
    reviewsText.includes(firstReview.title) || reviewsText.includes(firstReview.body.slice(0, 40)),
    firstReview.title);
}

/* ================= 7-8. variants ======================================== */
await page.goto(`${BASE}/dp/${COLOUR.slug}`, { waitUntil: "domcontentloaded" });
await settle(page);

const options = byTestId(page, TID.pdpVariantOption);
check("colour product renders every real variant", (await options.count()) === COLOUR.variants.length,
  `${await options.count()} vs ${COLOUR.variants.length}`);
check("first variant is selected by default",
  (await options.first().getAttribute("aria-pressed")) === "true");

/* selection is announced, and not by colour alone */
const legendBefore = await byTestId(page, TID.pdpVariants).innerText();
check("the selected variant is named in text", legendBefore.includes(COLOUR.variants[0].label),
  COLOUR.variants[0].label);

await options.nth(1).click();
await settle(page, 400);
check("selecting a variant updates aria-pressed",
  (await options.nth(1).getAttribute("aria-pressed")) === "true" &&
    (await options.first().getAttribute("aria-pressed")) === "false");
const legendAfter = await byTestId(page, TID.pdpVariants).innerText();
check("the selected variant name updates", legendAfter.includes(COLOUR.variants[1].label),
  COLOUR.variants[1].label);

/* a price delta, if the variant has one, must be reflected */
const delta = COLOUR.variants[1].priceDelta;
const priceWithVariant = money(await byTestId(page, TID.pdpPrice).innerText());
check("variant price delta is applied", priceWithVariant === (COLOUR.price + delta) / 100,
  `${priceWithVariant} vs ${(COLOUR.price + delta) / 100}`);

/* sized product exercises the chip form */
await page.goto(`${BASE}/dp/${SIZED.slug}`, { waitUntil: "domcontentloaded" });
await settle(page);
check("sized product renders its variants",
  (await byTestId(page, TID.pdpVariantOption).count()) === SIZED.variants.length);

/* a product with no variants shows no variant section at all */
await page.goto(`${BASE}/dp/${PLAIN.slug}`, { waitUntil: "domcontentloaded" });
await settle(page);
check("a product without variants renders no variant section",
  (await byTestId(page, TID.pdpVariants).count()) === 0);

/* ================= 9-10. quantity ======================================= */
const stepper = byTestId(page, TID.pdpQuantity);
check("the quantity control renders", await stepper.isVisible());
check("quantity starts at 1", (await stepper.innerText()).trim().startsWith("1"));

const dec = stepper.getByRole("button", { name: /Decrease quantity|Remove item/i });
check("quantity cannot go below the minimum", await dec.isDisabled());

await stepper.getByRole("button", { name: "Increase quantity" }).click();
await settle(page, 300);
check("increasing quantity works", (await stepper.innerText()).includes("2"));
await stepper.getByRole("button", { name: "Decrease quantity" }).click();
await settle(page, 300);
check("decreasing quantity works", (await stepper.innerText()).trim().startsWith("1"));

/* the cap is the real stock, or ten, whichever is lower */
const cap = Math.max(1, Math.min(10, PLAIN.stock));
for (let i = 1; i < cap; i++) {
  await stepper.getByRole("button", { name: "Increase quantity" }).click();
  await page.waitForTimeout(80);
}
check(`quantity caps at ${cap}`,
  await stepper.getByRole("button", { name: "Increase quantity" }).isDisabled(),
  `stock ${PLAIN.stock}`);

/* ================= 11-13. purchase ====================================== */
await page.goto(`${BASE}/dp/${PLAIN.slug}`, { waitUntil: "domcontentloaded" });
await settle(page);
const before = (await cartCount(page)) ?? 0;
await byTestId(page, TID.pdpAddToCart).click();
await settle(page, 800);

check("add to cart increments the cart", (await cartCount(page)) === before + 1,
  `${before} -> ${await cartCount(page)}`);
check("add to cart opens the mini-cart", await miniCart(page).isVisible());
const panelSubtotal = money(await byTestId(page, TID.miniCartSubtotal).innerText());
check("the mini-cart subtotal matches the product price", panelSubtotal === PLAIN.price / 100,
  `${panelSubtotal} vs ${PLAIN.price / 100}`);

await page.keyboard.press("Escape");
await settle(page, 400);

/* quantity is respected: add 3 and the cart gains 3 */
const before3 = (await cartCount(page)) ?? 0;
for (let i = 0; i < 2; i++) {
  await stepper.getByRole("button", { name: "Increase quantity" }).click();
  await page.waitForTimeout(120);
}
await byTestId(page, TID.pdpAddToCart).click();
await settle(page, 800);
check("add to cart respects the chosen quantity", (await cartCount(page)) === before3 + 3,
  `${before3} -> ${await cartCount(page)}`);
await page.keyboard.press("Escape");
await settle(page, 400);

/* Buy now routes to the cart rather than to payment */
await page.goto(`${BASE}/dp/${PLAIN.slug}`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.getByRole("button", { name: /^Buy now$/i }).click();
await page.waitForURL(/\/cart/, { timeout: 15000 });
check("buy now routes to the cart", page.url().endsWith("/cart"), page.url());

/* ================= 14. breadcrumbs ====================================== */
await page.goto(`${BASE}/dp/${PLAIN.slug}`, { waitUntil: "domcontentloaded" });
await settle(page);
const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
check("breadcrumbs render", await crumbs.isVisible());
const crumbHrefs = await crumbs.evaluate((el) =>
  [...el.querySelectorAll("a")].map((a) => a.getAttribute("href"))
);
check("breadcrumbs link to browse and the real department",
  crumbHrefs.includes("/browse") && crumbHrefs.includes(`/s?i=${PLAIN.categoryId}`),
  crumbHrefs.join(", "));

const crumbRes = await page.goto(BASE + `/s?i=${PLAIN.categoryId}`, { waitUntil: "domcontentloaded" });
check("the department breadcrumb resolves", crumbRes.status() === 200 &&
  (await byTestId(page, TID.productCard).count()) > 0);

/* ================= 17-19. related + recently viewed ===================== */
await page.goto(`${BASE}/dp/${PLAIN.slug}`, { waitUntil: "domcontentloaded" });
await settle(page, 900);
const relatedCards = await byTestId(page, TID.productCard).count();
check("related products render", relatedCards > 0, `${relatedCards}`);

const relHref = await byTestId(page, TID.productCardTitle).first().getAttribute("href");
check("a related product links to a product page", (relHref || "").startsWith("/dp/"), String(relHref));
const relRes = await page.goto(BASE + relHref, { waitUntil: "domcontentloaded" });
check("the related product page resolves", relRes.status() === 200, String(relRes.status()));

/* Recently viewed is not a PDP section and never was: the PDP records a view
   through RecordView, and the homepage shelf displays it. Assert the real
   contract - visiting products makes them appear on the homepage. */
await settle(page, 700);
const recordedIds = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("kartly.recentlyViewed") || "{}")?.state?.ids ?? [];
  } catch {
    return [];
  }
});
check("visiting a product records it", recordedIds.length > 0, `${recordedIds.length} recorded`);

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page, 900);
check("recorded products appear on the homepage shelf",
  /Recently viewed/i.test(await page.locator("main").innerText()));

/* one card implementation only - no PDP-specific card variant exists */
await page.goto(`${BASE}/dp/${PLAIN.slug}`, { waitUntil: "domcontentloaded" });
await settle(page, 700);
check("related products use the canonical card",
  (await byTestId(page, TID.productCard).count()) > 0 &&
    (await page.locator('[data-testid*="related-card"], [data-testid*="pdp-card"]').count()) === 0);

/* ================= 2. invalid product =================================== */
expecting404 = true;
const missing = await page.goto(`${BASE}/dp/not-a-real-product-xyz`, { waitUntil: "domcontentloaded" });
check("an invalid product returns 404", missing.status() === 404, String(missing.status()));
const notFoundText = await page.locator("main, body").first().innerText();
check("the 404 is a designed page, not a raw error", /can't find|not found|Popular/i.test(notFoundText));
await settle(page, 400);
expecting404 = false;

await page.screenshot({ path: path.join(OUT, "pdp-1440.png") });
await ctx.close();

/* ================= 20-21. responsive =================================== */
for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  const mctx = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: width <= 480,
    hasTouch: width <= 480,
  });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(`[${width}] ${String(e).slice(0, 140)}`));
  const w = `@${width}`;

  await mp.goto(`${BASE}/dp/${COLOUR.slug}`, { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(800);

  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  check(`${w} no horizontal overflow`, sw <= width + 1, `${sw}`);
  check(`${w} the gallery renders`, await byTestId(mp, TID.pdpGallery).isVisible());
  check(`${w} the decision column renders`, await byTestId(mp, TID.pdpDecisionCard).isVisible());
  check(`${w} add to cart is reachable`, await byTestId(mp, TID.pdpAddToCart).isVisible());

  /* the purchase controls must clear the fixed tab bar on mobile */
  if (width <= 1023) {
    const clash = await mp.evaluate(() => {
      const nav = document.querySelector('[data-testid="bottom-tabs"]');
      const cta = document.querySelector('[data-testid="pdp-add-to-cart"]');
      if (!nav || !cta) return false;
      const n = nav.getBoundingClientRect();
      const c = cta.getBoundingClientRect();
      return c.bottom > n.top && c.top < n.bottom;
    });
    check(`${w} purchase controls do not sit under the tab bar`, !clash);
  }

  if (width === 390) await mp.screenshot({ path: path.join(OUT, "pdp-390.png") });
  await mctx.close();
}

await browser.close();

check("no unexpected 404 responses", badResponses.length === 0, badResponses.slice(0, 3).join(" | "));
check("no console, page or hydration errors", errors.length === 0, errors.slice(0, 3).join(" | "));

console.log(`\n${total - problems.length}/${total} PDP checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
