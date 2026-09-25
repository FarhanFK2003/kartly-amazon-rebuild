/**
 * Kartly regression gate.
 *
 * Ported from scripts/qa-smoke-final.mjs onto the semantic selector contract in
 * ./selectors.mjs. Every locator is a role + accessible name or a test id from
 * the contract; none is a CSS class, which is what made the previous suites
 * brittle enough that a redesign could silently invalidate them.
 *
 * The behavioural assertions are unchanged from the original - see
 * ./COVERAGE.md. This is the gate every later wave must keep green.
 *
 *   node scripts/qa/smoke-final.mjs <output-dir>
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import {
  LIVE_TIDS,
  ROUTES,
  addToCartCta,
  buyBoxAddToCart,
  byTestId,
  cartCount,
  cartLink,
  goToCart,
  miniCart,
  money,
  placeOrder,
  proceedToCheckout,
  searchBox,
  searchOverlay,
  searchTrigger,
  TID,
} from "./selectors.mjs";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
let total = 0;

function check(name, passed, detail = "") {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

const settle = (page, ms = 800) => page.waitForTimeout(ms);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/DevTools|preloaded using link preload/.test(t)) return;
  errors.push(t.slice(0, 160));
});

/* ---- 0. the contract itself is wired --------------------------------------
   Nothing else in the toolchain can catch lib/testids.ts and selectors.mjs
   drifting apart, so the gate asserts a sample of the live ids exist. */
await page.goto(BASE + ROUTES.search, { waitUntil: "domcontentloaded" });
await settle(page, 1000);
for (const id of [TID.productCard, TID.productCardTitle, TID.productCardPrice, TID.appBar, TID.searchTrigger]) {
  check(`test-id contract: ${id} is rendered`, (await byTestId(page, id).count()) > 0);
}

/* ---- 1. homepage ---------------------------------------------------------- */
await page.goto(BASE + ROUTES.home, { waitUntil: "domcontentloaded" });
await settle(page, 1000);
check(
  "homepage renders department discovery",
  (await page.getByRole("heading", { name: /Shop by department/i }).count()) > 0
);

/* ---- 2. search ------------------------------------------------------------
   Search now lives behind a trigger that opens a full-screen overlay. The
   behaviour asserted is unchanged: a query reaches /s and returns results. */
await searchTrigger(page).click();
await page.waitForTimeout(400);
check("the search trigger opens the overlay", await searchOverlay(page).isVisible());

await searchBox(page).fill("camera");
await page.keyboard.press("Enter");
await page.waitForURL(/\/s\?/, { timeout: 15000 });
await settle(page);
check("search returns results", (await byTestId(page, TID.productCard).count()) > 0);
check("the overlay closes after searching", !(await searchOverlay(page).isVisible()));

/* ---- 3. product page ------------------------------------------------------ */
await byTestId(page, TID.productCardTitle).first().click();
await page.waitForURL(/\/dp\//, { timeout: 15000 });
await settle(page);
check("product page has one top-level heading", (await page.getByRole("heading", { level: 1 }).count()) === 1);

/* ---- 4-5. add to cart ----------------------------------------------------- */
await buyBoxAddToCart(page).first().click();
await settle(page);
check("adding opens the mini-cart", await miniCart(page).isVisible());
check("adding increments the header cart count", (await cartCount(page)) === 1, `count ${await cartCount(page)}`);

const panelSubtotal = money(await byTestId(page, TID.miniCartSubtotal).textContent());
check("mini-cart shows a positive subtotal", panelSubtotal > 0, String(panelSubtotal));

/* ---- 6. cart -------------------------------------------------------------- */
await goToCart(page).click();
await page.waitForURL(/\/cart/, { timeout: 15000 });
await settle(page);
const cartSubtotal = money(await byTestId(page, TID.cartSubtotal).textContent());
check("cart subtotal matches the mini-cart", cartSubtotal === panelSubtotal, `${cartSubtotal} vs ${panelSubtotal}`);

/* ---- 7. checkout ---------------------------------------------------------- */
await proceedToCheckout(page).first().click();
await page.waitForURL(/\/checkout/, { timeout: 15000 });
await settle(page);

await page.getByLabel(/Full name/i).fill("Ada Lovelace");
await page.getByLabel(/Street address/i).fill("12 Analytical Way");
await page.getByLabel(/^City/i).fill("San Francisco");
await page.locator("select").first().selectOption({ index: 5 });
await page.getByLabel(/ZIP/i).fill("94103");
await page.getByLabel(/Phone/i).fill("5550192837");
await page.getByRole("button", { name: /Use this address/i }).click();
await settle(page, 600);

await page.getByText("Credit or debit card").click().catch(() => {});
await settle(page, 300);
const card = page.getByLabel(/Card number/i);
if (await card.count()) {
  await card.fill("4111111111111111");
  await page.getByLabel(/Name on card/i).fill("Ada Lovelace").catch(() => {});
  await page.getByLabel(/Expiry|MM \/ YY/i).fill("12/29").catch(() => {});
  await page.getByLabel(/CVV|Security/i).fill("123").catch(() => {});
}
await page.getByRole("button", { name: /Use this payment method/i }).click();
await settle(page, 600);

/* The total is asserted before the order is placed, because a defect once had
   it reading the subtotal and nothing ever checked. */
const orderTotal = money(await byTestId(page, TID.orderTotal).textContent());
check("order total exceeds the subtotal by shipping and tax", orderTotal > cartSubtotal,
  `total ${orderTotal} vs subtotal ${cartSubtotal}`);

await placeOrder(page).first().click();
await page.waitForURL(/order-confirmation/, { timeout: 20000 });
await settle(page, 900);
check("checkout completes", /order-confirmation/.test(page.url()));

/* ---- 8-9. confirmation ---------------------------------------------------- */
const confirmation = (await page.locator("main").textContent()) || "";
check("confirmation shows an order number", /KTL-/.test(confirmation));
check("cart is empty after ordering", (await cartCount(page)) === 0, `count ${await cartCount(page)}`);

/* ---- 10. order history ---------------------------------------------------- */
await page.goto(BASE + ROUTES.orders, { waitUntil: "domcontentloaded" });
await settle(page);
check("the order appears in order history", /KTL-/.test((await page.locator("main").textContent()) || ""));

/* ---- 11. mobile ----------------------------------------------------------- */
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mpage = await mctx.newPage();
mpage.on("pageerror", (e) => errors.push(`mobile pageerror: ${String(e).slice(0, 160)}`));
await mpage.goto(BASE + ROUTES.home, { waitUntil: "domcontentloaded" });
await settle(mpage, 1000);
const scrollWidth = await mpage.evaluate(() => document.documentElement.scrollWidth);
check("mobile homepage has no horizontal overflow", scrollWidth <= 391, `scrollWidth ${scrollWidth}`);
await mpage.screenshot({ path: path.join(OUT, "mobile-home.png") });
await mctx.close();

/* ---- 12. console health --------------------------------------------------- */
check("no console or page errors", errors.length === 0, errors.join(" | "));

/* the ids reserved for later waves must not be rendered yet */
check(
  "reserved test ids are not wired ahead of their wave",
  (await byTestId(page, TID.facetBar).count()) === 0 &&
    (await byTestId(page, TID.filterSheet).count()) === 0 &&
    (await byTestId(page, TID.pdpDecisionCard).count()) === 0
);

await browser.close();

console.log(`\n${total - problems.length}/${total} smoke checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
