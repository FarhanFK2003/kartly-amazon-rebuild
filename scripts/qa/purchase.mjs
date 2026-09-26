/**
 * The purchase journey: PDP → drawer → cart → checkout → confirmation.
 *
 * Ports the behavioural coverage of scripts/qa-purchase.mjs, scripts/qa-fbt.mjs
 * and scripts/qa-smoke-drawer.mjs onto the redesigned flow. See COVERAGE.md for
 * the selector mapping.
 *
 * Money is never hardcoded here. Expected subtotal, shipping, tax and total are
 * recomputed in this file from data/catalog.json using the same constants the
 * application uses, and compared with what is rendered - so a page that shows a
 * total the commerce logic did not produce fails.
 *
 *   node scripts/qa/purchase.mjs <output-dir>
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { TID, byTestId, cartCount, miniCart, goToCart } from "./selectors.mjs";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const catalog = JSON.parse(fs.readFileSync("data/catalog.json", "utf8"));
const bySlug = (slug) => catalog.products.find((p) => p.slug === slug);

/* The same constants lib/commerce.ts uses. Read from the source of truth so a
   change there shows up here as a failure rather than a silent divergence. */
const commerceSrc = fs.readFileSync("lib/commerce.ts", "utf8");
const constOf = (name) => Number(new RegExp(`${name}:\\s*([\\d.]+)`).exec(commerceSrc)[1]);
const FREE_SHIPPING = constOf("freeShippingThreshold");
const SHIPPING = constOf("standardShippingCents");
const TAX_RATE = constOf("taxRate");

/* A cheap product, so a single unit sits below the free-shipping threshold and
   the shipping line is actually exercised. */
const CHEAP = catalog.products
  .filter((p) => p.stock >= 5 && p.variants.length === 0 && p.price < FREE_SHIPPING / 2)
  .sort((a, b) => a.price - b.price)[0];

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

/** The expected totals, computed the way lib/commerce.ts computes them. */
function expectedTotals(subtotalCents) {
  const freeShipping = subtotalCents >= FREE_SHIPPING;
  const shipping = subtotalCents === 0 || freeShipping ? 0 : SHIPPING;
  const tax = Math.round(subtotalCents * TAX_RATE);
  return {
    subtotal: subtotalCents / 100,
    shipping: shipping / 100,
    tax: tax / 100,
    total: (subtotalCents + shipping + tax) / 100,
    freeShipping,
  };
}

const browser = await chromium.launch();
const errors = [];
const badResponses = [];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`));
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|did not match|Text content does not match/i.test(t)) errors.push(`HYDRATION: ${t.slice(0, 160)}`);
  if (m.type() !== "error") return;
  if (/DevTools|preloaded using link preload/.test(t)) return;
  errors.push(t.slice(0, 140));
});
page.on("response", (r) => {
  if (r.status() === 404) badResponses.push(r.url().slice(0, 90));
});

/* Warm-up. The first request after a build can be slow enough that a click
   lands before hydration, which looks like a broken control rather than a cold
   server. Waiting for the network to settle once removes that race. */
await page.goto(`${BASE}/dp/${CHEAP.slug}`, { waitUntil: "networkidle" });
await settle(page, 400);

/* ---- 1-3. add from the PDP -------------------------------------------- */
await page.goto(`${BASE}/dp/${CHEAP.slug}`, { waitUntil: "networkidle" });
await settle(page, 600);

const before = (await cartCount(page)) ?? 0;
await byTestId(page, TID.pdpAddToCart).click();
await settle(page, 800);

check("adding from the PDP opens the drawer", await miniCart(page).isVisible());
check("the cart count updates", (await cartCount(page)) === before + 1,
  `${before} -> ${await cartCount(page)}`);

const drawerSubtotal = money(await byTestId(page, TID.miniCartSubtotal).innerText());
check("the drawer subtotal is the product price", drawerSubtotal === CHEAP.price / 100,
  `${drawerSubtotal} vs ${CHEAP.price / 100}`);

/* ---- 10. drawer → cart ------------------------------------------------- */
await goToCart(page).click();
await page.waitForURL(/\/cart/, { timeout: 15000 });
await settle(page, 800);
check("the drawer reaches the cart", page.url().endsWith("/cart"));

/* ---- 4. the cart shows the right product ------------------------------- */
const lines = byTestId(page, TID.cartLine);
check("the cart has one line", (await lines.count()) === 1, `${await lines.count()}`);
const lineTitle = (await byTestId(page, TID.cartLineTitle).first().innerText()).trim();
check("the cart line is the product that was added", lineTitle === CHEAP.title, lineTitle.slice(0, 40));

/* ---- 5-7, 14-17. quantity and totals ----------------------------------- */
for (const qty of [1, 3]) {
  if (qty > 1) {
    for (let i = 1; i < qty; i++) {
      await byTestId(page, TID.cartLineQuantity).getByRole("button", { name: "Increase quantity" }).click();
      await page.waitForTimeout(150);
    }
    await settle(page, 400);
  }

  const e = expectedTotals(CHEAP.price * qty);
  check(`qty ${qty}: line total is correct`,
    money(await byTestId(page, TID.cartLineTotal).first().innerText()) === e.subtotal,
    `${money(await byTestId(page, TID.cartLineTotal).first().innerText())} vs ${e.subtotal}`);
  check(`qty ${qty}: subtotal is correct`,
    money(await byTestId(page, TID.cartSubtotal).innerText()) === e.subtotal);

  const summary = await page.locator("aside").first().innerText();
  const shippingShown = e.freeShipping ? /Free/i.test(summary) : summary.includes(e.shipping.toFixed(2));
  check(`qty ${qty}: shipping is correct`, shippingShown, `expected ${e.freeShipping ? "Free" : e.shipping}`);
  check(`qty ${qty}: tax is correct`, summary.includes(e.tax.toFixed(2)), `expected ${e.tax}`);
  check(`qty ${qty}: total is correct`,
    money(await byTestId(page, TID.cartTotal).innerText()) === e.total,
    `${money(await byTestId(page, TID.cartTotal).innerText())} vs ${e.total}`);
}

/* ---- 8-9. remove and empty --------------------------------------------- */
await page.getByRole("button", { name: /Remove .* from cart/i }).first().click();
await settle(page, 700);
check("removing the last line empties the cart", (await lines.count()) === 0);
const emptyText = await page.locator("main").innerText();
check("the empty cart state renders", /cart is empty/i.test(emptyText));
check("the empty cart offers a way back", (await page.getByRole("link", { name: /Shop by department|Browse all/i }).count()) > 0);
check("the cart badge is zero when empty", (await cartCount(page)) === 0);

await page.screenshot({ path: path.join(OUT, "cart-empty.png") });

/* ---- 21. frequently bought together ------------------------------------ */
/* Find a product that actually has a bundle rather than assuming one does. */
let bundleSlug = null;
for (const p of catalog.products.slice(0, 30)) {
  await page.goto(`${BASE}/dp/${p.slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  if (await byTestId(page, TID.bundle).count()) {
    bundleSlug = p.slug;
    break;
  }
}
check("at least one product offers a bundle", !!bundleSlug, "none in the first 30 products");

if (bundleSlug) {
  const bundle = byTestId(page, TID.bundle);
  const boxes = bundle.locator('input[type="checkbox"]');
  const boxCount = await boxes.count();
  check("the bundle offers more than one item", boxCount >= 2, `${boxCount}`);

  const allChecked = await boxes.evaluateAll((els) => els.every((e) => e.checked));
  check("every bundle item starts selected", allChecked);

  const totalBefore = money(await bundle.innerText());
  await boxes.last().uncheck();
  await settle(page, 400);
  const totalAfter = money(await bundle.innerText());
  check("deselecting an item lowers the bundle total", totalAfter < totalBefore,
    `${totalBefore} -> ${totalAfter}`);

  await boxes.last().check();
  await settle(page, 400);
  const cartBefore = (await cartCount(page)) ?? 0;
  await bundle.getByRole("button", { name: /Add .* to cart/i }).click();
  await settle(page, 800);
  check("adding the bundle adds every selected item",
    (await cartCount(page)) === cartBefore + boxCount,
    `${cartBefore} -> ${await cartCount(page)} for ${boxCount} items`);
  await page.keyboard.press("Escape");
  await settle(page, 400);
}

/* ---- 11-13, 18-20. checkout -------------------------------------------- */
/* Start from a clean, known cart so the expected totals are exact. */
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.removeItem("kartly.cart"));
await page.goto(`${BASE}/dp/${CHEAP.slug}`, { waitUntil: "domcontentloaded" });
await settle(page, 700);
await byTestId(page, TID.pdpAddToCart).click();
await settle(page, 700);
await page.keyboard.press("Escape");

await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
await settle(page, 700);

check("checkout renders its summary", await byTestId(page, TID.checkoutSummary).isVisible());
check("checkout fields render", (await page.getByLabel(/Full name/i).count()) === 1);
check("place order is blocked until the steps are done",
  await byTestId(page, TID.placeOrder).isDisabled());

/* 12. required-field validation */
await page.getByRole("button", { name: /Use this address/i }).click();
await settle(page, 500);
const errorCount = await page.locator('[role="alert"], .text-accent').count();
check("submitting an empty address shows validation errors", errorCount > 0, `${errorCount}`);
check("validation keeps the shopper on step 1",
  (await page.getByLabel(/Full name/i).count()) === 1);

/* fill it properly */
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

/* 14-17: the checkout summary must match the commerce calculation */
const e1 = expectedTotals(CHEAP.price);
const summaryText = await byTestId(page, TID.checkoutSummary).innerText();
check("checkout subtotal is correct", summaryText.includes(e1.subtotal.toFixed(2)), `${e1.subtotal}`);
check("checkout shipping is correct",
  e1.freeShipping ? /Free/i.test(summaryText) : summaryText.includes(e1.shipping.toFixed(2)),
  `${e1.freeShipping ? "Free" : e1.shipping}`);
check("checkout tax is correct",
  money(await byTestId(page, TID.checkoutTax).innerText()) === e1.tax, `${e1.tax}`);
check("checkout total is correct",
  money(await byTestId(page, TID.orderTotal).innerText()) === e1.total, `${e1.total}`);

/* 18-20: place the order */
check("place order is enabled once the steps are done",
  !(await byTestId(page, TID.placeOrder).isDisabled()));
await byTestId(page, TID.placeOrder).click();
await page.waitForURL(/order-confirmation/, { timeout: 20000 });
await settle(page, 900);

check("the order confirmation renders", await byTestId(page, TID.orderConfirmation).isVisible());
const orderNumber = (await byTestId(page, TID.orderNumber).innerText()).trim();
check("an order number is generated in the existing format", /^KTL-[A-Z0-9]+-[A-Z0-9]+$/.test(orderNumber),
  orderNumber);

const confirmationText = await page.locator("main").innerText();
check("the confirmation lists the purchased product", confirmationText.includes(CHEAP.title.split(",")[0]));
check("the confirmation total matches the checkout total", confirmationText.includes(e1.total.toFixed(2)),
  `${e1.total}`);
check("the confirmation is honest that nothing was charged",
  /simulated|no payment|nothing is charged|nothing has been charged/i.test(confirmationText));
check("the cart is empty after ordering", (await cartCount(page)) === 0);

await page.screenshot({ path: path.join(OUT, "confirmation.png") });
await ctx.close();

/* ---- 22-24. mobile and responsive -------------------------------------- */
for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  const mctx = await browser.newContext({
    viewport: { width, height: 880 },
    isMobile: width <= 480,
    hasTouch: width <= 480,
  });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(`[${width}] ${String(e).slice(0, 140)}`));
  const w = `@${width}`;

  /* seed a cart so the real layout renders, not the empty state */
  await mp.goto(`${BASE}/dp/${CHEAP.slug}`, { waitUntil: "domcontentloaded" });
  await mp.waitForTimeout(700);
  await byTestId(mp, TID.pdpAddToCart).click();
  await mp.waitForTimeout(600);
  await mp.keyboard.press("Escape");

  for (const [label, route] of [["cart", "/cart"], ["checkout", "/checkout"]]) {
    await mp.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await mp.waitForTimeout(700);

    const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
    check(`${w} ${label} has no horizontal overflow`, sw <= width + 1, `${sw}`);

    /* the primary action must not sit under the fixed tab bar */
    if (width <= 1023) {
      const clash = await mp.evaluate(() => {
        const nav = document.querySelector('[data-testid="bottom-tabs"]');
        if (!nav) return false;
        const n = nav.getBoundingClientRect();
        const cta = [...document.querySelectorAll("a,button")].find((el) =>
          /checkout|place your order/i.test(el.textContent || "")
        );
        if (!cta) return false;
        const c = cta.getBoundingClientRect();
        return c.bottom > n.top && c.top < n.bottom;
      });
      check(`${w} ${label} action clears the tab bar`, !clash);
    }
  }

  if (width === 390) await mp.screenshot({ path: path.join(OUT, "checkout-390.png") });
  await mctx.close();
}

await browser.close();

check("no unexpected 404 responses", badResponses.length === 0, badResponses.slice(0, 3).join(" | "));
check("no console, page or hydration errors", errors.length === 0, errors.slice(0, 3).join(" | "));

console.log(`\n${total - problems.length}/${total} purchase checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
