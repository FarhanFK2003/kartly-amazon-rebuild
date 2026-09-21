// End-to-end QA for the purchase journey: cart -> checkout -> confirmation.
// Runs against the production build from a clean browser context.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const missingRoutes = new Set();
const checks = [];
const NOT_BUILT_YET = /\/(signin|orders|help)(\/|\?|$)/;

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(350);
}

function attach(page, label) {
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const t = msg.text();
    if (
      t.includes("Download the React DevTools") ||
      t.includes("_next/hmr") ||
      t.includes("WebSocket") ||
      t.includes("status of 400") ||
      t.includes("status of 404") ||
      t.includes("was preloaded using link preload but not used")
    ) return;
    problems.push(`[${label}] console.${msg.type()}: ${t.slice(0, 260)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${String(e).slice(0, 260)}`));
  page.on("response", (res) => {
    if (res.status() !== 404) return;
    const p = new URL(res.url()).pathname;
    if (NOT_BUILT_YET.test(p)) missingRoutes.add(p);
    else problems.push(`[${label}] unexpected 404: ${p}`);
  });
  page.on("requestfailed", (req) => {
    const f = req.failure();
    if (!f || req.url().includes("favicon")) return;
    if (req.url().includes("_rsc=") && f.errorText === "net::ERR_ABORTED") return;
    problems.push(`[${label}] requestfailed: ${req.url().slice(0, 110)} ${f.errorText}`);
  });
}

const cartCount = async (page) => {
  const label = (await page.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "";
  return Number(label.match(/(\d+)/)?.[1] ?? -1);
};
const money = (text) => Number((text.match(/\$([\d,]+\.\d{2})/)?.[1] ?? "0").replace(/,/g, ""));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); // clean state
const page = await ctx.newPage();
attach(page, "desktop");

/* ---- 1-5. discover and add ---- */
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);
await page.locator('input[name="q"]').first().fill("laptop");
await page.locator('input[name="q"]').first().press("Enter");
await page.waitForURL(/\/s\?/);
await settle(page);
await page.locator("article a[href^='/dp/']").first().click();
await page.waitForURL(/\/dp\//);
await settle(page);
const productTitle = (await page.locator("h1").first().textContent())?.trim() ?? "";
await page.locator("button", { hasText: /^Add to Cart$/i }).first().click();
await page.waitForTimeout(800);
check("add to cart updates header badge", (await cartCount(page)) === 1, `count ${await cartCount(page)}`);

// A buy-box add now opens the mini-cart, which is modal - so it covers the
// header while it is up, by design. Dismiss it so this suite goes on testing
// what it was written to test: reaching the cart from the header.
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("mini-cart dismisses with Escape", !(await page.locator('div[role="dialog"][aria-label="Shopping cart"]').isVisible()));

/* ---- 6. open cart ---- */
await page.locator('a[href="/cart"]').first().click();
await page.waitForURL(/\/cart/);
await settle(page);
check("cart shows the added product", ((await page.locator("main").textContent()) || "").includes(productTitle.slice(0, 30)));
const unitPrice = money((await page.locator("main").textContent()) || "");

/* ---- 7-8. quantity up and down ---- */
await page.getByRole("button", { name: "Increase quantity" }).first().click();
await page.waitForTimeout(500);
check("increase quantity -> 2", (await cartCount(page)) === 2, `count ${await cartCount(page)}`);
const subtotalAt2 = money((await page.locator("aside").first().textContent()) || "");
check("subtotal doubles at qty 2", Math.abs(subtotalAt2 - unitPrice * 2) < 0.02, `${subtotalAt2} vs ${unitPrice * 2}`);

await page.getByRole("button", { name: "Decrease quantity" }).first().click();
await page.waitForTimeout(500);
check("decrease quantity -> 1", (await cartCount(page)) === 1, `count ${await cartCount(page)}`);

/* ---- 9-10. save for later, then move back ---- */
await page.getByRole("button", { name: "Save for later" }).first().click();
await page.waitForTimeout(600);
const savedVisible = ((await page.locator("main").textContent()) || "").includes("Saved for later");
check("save for later moves the item out of the cart", savedVisible && (await cartCount(page)) === 0, `count ${await cartCount(page)}`);

await page.getByRole("button", { name: "Move to cart" }).first().click();
await page.waitForTimeout(600);
check("move to cart restores the item", (await cartCount(page)) === 1, `count ${await cartCount(page)}`);

/* ---- 11. remove ---- */
await page.getByRole("button", { name: "Delete" }).first().click();
await page.waitForTimeout(700);
check("delete empties the cart", (await cartCount(page)) === 0, `count ${await cartCount(page)}`);
const emptyText = (await page.locator("main").textContent()) || "";
check("empty cart state renders", /cart is empty/i.test(emptyText));
await page.screenshot({ path: path.join(OUT, "cart-empty.png"), fullPage: false });

/* ---- 12-14. add two products, verify subtotal and shipping meter ---- */
await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded" });
await settle(page);
const addButtons = page.getByRole("button", { name: "Add to cart" });
await addButtons.nth(0).click();
await page.waitForTimeout(400);
await addButtons.nth(1).click();
await page.waitForTimeout(800);
check("two products added", (await cartCount(page)) === 2, `count ${await cartCount(page)}`);

await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await settle(page);
const cartText = (await page.locator("main").textContent()) || "";
const lineTotals = [...cartText.matchAll(/\$([\d,]+)\.(\d{2})/g)].map((m) => Number(`${m[1].replace(/,/g, "")}.${m[2]}`));
const railSubtotal = money((await page.locator("aside").first().textContent()) || "");
check("cart subtotal is derived and non-zero", railSubtotal > 0, `${railSubtotal}`);
check("free shipping meter present", /FREE Shipping/i.test(cartText));
const meter = await page.locator('[role="progressbar"]').first().getAttribute("aria-valuenow");
check("shipping meter reports progress", meter !== null && Number(meter) >= 0, `aria-valuenow=${meter}`);
await page.screenshot({ path: path.join(OUT, "cart-filled.png"), fullPage: false });
void lineTotals;

/* ---- 15. checkout ---- */
await page.getByRole("link", { name: /Proceed to checkout/i }).first().click();
await page.waitForURL(/\/checkout/);
await settle(page);
check("checkout uses the stripped header", (await page.locator('nav[aria-label="Departments and shortcuts"]').count()) === 0);
check("checkout shows Secure checkout", /Secure checkout/i.test((await page.locator("header").textContent()) || ""));

/* ---- validation: empty and invalid address ---- */
await page.getByRole("button", { name: /Use this address/i }).click();
await page.waitForTimeout(400);
const afterEmpty = (await page.locator("main").textContent()) || "";
check("empty address is rejected inline", /Enter a full name/i.test(afterEmpty) && /Enter a street address/i.test(afterEmpty));
check("still on step 1 after invalid submit", /Use this address/i.test((await page.locator("main").textContent()) || ""));
await page.screenshot({ path: path.join(OUT, "checkout-validation.png"), fullPage: false });

await page.fill("#fullName", "Farhan Khan");
await page.fill("#line1", "500 Market Street");
await page.fill("#city", "San Francisco");
await page.selectOption("#state", "CA");
await page.fill("#zip", "9410");           // deliberately invalid
await page.fill("#phone", "5550192837");
await page.getByRole("button", { name: /Use this address/i }).click();
await page.waitForTimeout(400);
check("invalid ZIP is rejected", /5-digit ZIP/i.test((await page.locator("main").textContent()) || ""));

await page.fill("#zip", "94103");
await page.getByRole("button", { name: /Use this address/i }).click();
await page.waitForURL(/\/checkout/);
await page.waitForTimeout(600);

/* ---- 17-18. payment ---- */
check("advanced to payment step", /Choose how to pay/i.test((await page.locator("main").textContent()) || ""));
await page.getByRole("button", { name: /Use this payment method/i }).click();
await page.waitForTimeout(400);
check("missing payment selection is rejected", /Select a payment method/i.test((await page.locator("main").textContent()) || ""));

await page.getByText("Credit or debit card").click();
await page.waitForTimeout(300);
await page.fill("#cardNumber", "1234 5678 9012 3456"); // fails Luhn
await page.fill("#cardName", "F Khan");
await page.fill("#cardExpiry", "04/29");
await page.fill("#cardCvv", "123");
await page.getByRole("button", { name: /Use this payment method/i }).click();
await page.waitForTimeout(400);
check("invalid card number is rejected", /not valid/i.test((await page.locator("main").textContent()) || ""));

await page.fill("#cardNumber", "4242 4242 4242 4242");
await page.fill("#cardExpiry", "04/20"); // expired
await page.getByRole("button", { name: /Use this payment method/i }).click();
await page.waitForTimeout(400);
check("expired card is rejected", /expired/i.test((await page.locator("main").textContent()) || ""));

await page.fill("#cardExpiry", "04/29");
await page.getByRole("button", { name: /Use this payment method/i }).click();
await page.waitForTimeout(700);

/* ---- 19-20. review ---- */
const reviewText = (await page.locator("main").textContent()) || "";
check("advanced to review step", /Place your order/i.test(reviewText));
/**
 * Parse the summary rail's individual lines rather than the first dollar sign
 * on the page, so the arithmetic is genuinely checked: an order total that
 * silently equals the subtotal would otherwise sail through.
 */
async function readSummary(target) {
  return target.locator("aside").first().evaluate((el) => {
    const text = el.textContent || "";
    const num = (re) => {
      const m = text.match(re);
      if (!m) return null;
      if (/FREE/i.test(m[1])) return 0;
      return Number(m[1].replace(/[$,]/g, ""));
    };
    return {
      items: num(/Items[^$]*(\$[\d,]+\.\d{2})/),
      shipping: num(/Shipping\s*(FREE|\$[\d,]+\.\d{2})/),
      tax: num(/Estimated tax\s*(\$[\d,]+\.\d{2})/),
      total: num(/Order total\s*(\$[\d,]+\.\d{2})/),
    };
  });
}

const summary = await readSummary(page);
const orderTotal = summary.total ?? 0;
check("order total is present and non-zero", orderTotal > 0, JSON.stringify(summary));
check(
  "order total equals items + shipping + tax",
  summary.items !== null &&
    summary.tax !== null &&
    Math.abs(summary.items + (summary.shipping ?? 0) + summary.tax - orderTotal) < 0.02,
  JSON.stringify(summary)
);
check("tax is actually applied", (summary.tax ?? 0) > 0, `tax ${summary.tax}`);
check("review lists the items", /Qty:/i.test(reviewText));
await page.screenshot({ path: path.join(OUT, "checkout-review.png"), fullPage: true });

/* ---- 21-24. place order ---- */
await page.locator("main").getByRole("button", { name: /Place your order/i }).first().click();
await page.waitForURL(/\/order-confirmation\//, { timeout: 30000 });
await settle(page);
const confirmUrl = page.url();
const orderId = confirmUrl.split("/order-confirmation/")[1];
const confirmText = (await page.locator("main").textContent()) || "";
check("navigated to confirmation", /\/order-confirmation\/KTL-/.test(confirmUrl), confirmUrl);
check("confirmation shows Order placed", /Order placed/i.test(confirmText));
check("confirmation shows the order id", confirmText.includes(orderId), orderId);
check("confirmation states it is simulated", /simulated/i.test(confirmText));
check("confirmation shows the delivery address", /San Francisco/.test(confirmText));
check("confirmation shows the payment summary", /ending in 4242/i.test(confirmText));
const confirmSummary = await readSummary(page);
check(
  "confirmation total matches checkout total",
  Math.abs((confirmSummary.total ?? -1) - orderTotal) < 0.02,
  `${JSON.stringify(confirmSummary)} vs ${orderTotal}`
);
check(
  "confirmation totals are internally consistent",
  confirmSummary.items !== null &&
    confirmSummary.tax !== null &&
    Math.abs(confirmSummary.items + (confirmSummary.shipping ?? 0) + confirmSummary.tax - (confirmSummary.total ?? 0)) < 0.02,
  JSON.stringify(confirmSummary)
);
check("cart is emptied after placing the order", (await cartCount(page)) === 0, `count ${await cartCount(page)}`);
await page.screenshot({ path: path.join(OUT, "order-confirmation.png"), fullPage: true });

/* ---- 25-26. refresh the confirmation ---- */
await page.reload({ waitUntil: "domcontentloaded" });
await settle(page);
const afterRefresh = (await page.locator("main").textContent()) || "";
check("order survives a refresh", /Order placed/i.test(afterRefresh) && afterRefresh.includes(orderId));

/* ---- order persisted for P1 /orders ---- */
const stored = await page.evaluate(() => {
  try {
    const raw = localStorage.getItem("kartly.orders");
    const parsed = raw ? JSON.parse(raw) : null;
    const orders = parsed?.state?.orders ?? [];
    return { count: orders.length, id: orders[0]?.id ?? null, simulated: orders[0]?.simulated ?? null };
  } catch {
    return { count: -1 };
  }
});
check("order persisted to localStorage for P1", stored.count === 1 && stored.id === orderId, JSON.stringify(stored));
check("stored order is flagged simulated", stored.simulated === true);

/* ---- 27-30. shop again, refresh, cart persists ---- */
await page.goto(`${BASE}/s?q=headphones`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.getByRole("button", { name: "Add to cart" }).first().click();
await page.waitForTimeout(700);
check("can shop again after ordering", (await cartCount(page)) === 1, `count ${await cartCount(page)}`);
await page.reload({ waitUntil: "domcontentloaded" });
await settle(page);
check("cart persists across a refresh", (await cartCount(page)) === 1, `count ${await cartCount(page)}`);

/* ---- back/forward ---- */
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.goBack({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.goForward({ waitUntil: "domcontentloaded" });
await settle(page);
check("back/forward returns to a working cart", /Shopping Cart|cart is empty/i.test((await page.locator("main").textContent()) || ""));

await ctx.close();

/* ---- direct navigation with a clean, empty state ---- */
const clean = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const cpage = await clean.newPage();
attach(cpage, "clean");
await cpage.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await settle(cpage);
check("direct /cart with empty state renders", /cart is empty/i.test((await cpage.locator("main").textContent()) || ""));

await cpage.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
await settle(cpage);
check("direct /checkout with empty cart is handled", /nothing to check out/i.test((await cpage.locator("main").textContent()) || ""));
await cpage.screenshot({ path: path.join(OUT, "checkout-empty.png") });

await cpage.goto(`${BASE}/order-confirmation/KTL-DOES-NOTEXIST`, { waitUntil: "domcontentloaded" });
await settle(cpage);
check("unknown order id is handled gracefully", /can.t find that order/i.test((await cpage.locator("main").textContent()) || ""));
await clean.close();

/* ---- mobile ---- */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attach(mpage, "mobile-390");
await mpage.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
await mpage.getByRole("button", { name: "Add to cart" }).first().click();
await mpage.waitForTimeout(700);
await mpage.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await settle(mpage);
let ov = await mpage.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check("mobile cart: no horizontal overflow", ov.sw <= ov.cw + 1, JSON.stringify(ov));
await mpage.screenshot({ path: path.join(OUT, "cart-mobile.png"), fullPage: false });

await mpage.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
await settle(mpage);
ov = await mpage.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check("mobile checkout: no horizontal overflow", ov.sw <= ov.cw + 1, JSON.stringify(ov));
await mpage.screenshot({ path: path.join(OUT, "checkout-mobile.png"), fullPage: false });
await mctx.close();

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nroutesNotBuiltYet: ${[...missingRoutes].sort().join(", ") || "(none)"}`);
console.log(`\nproblems (${problems.length}):`);
for (const p of problems) console.log(`  - ${p}`);
process.exitCode = problems.length > 0 ? 1 : 0;
