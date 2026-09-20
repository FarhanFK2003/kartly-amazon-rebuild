// End-to-end QA for the discovery journey: home -> search -> result -> PDP.
// Drives a real Chromium against the production build and asserts on what the
// page actually renders and does, not on the markup alone.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const missingRoutes = new Set();
const checks = [];
const NOT_BUILT_YET = /\/(cart|signin|orders|help|checkout)(\/|\?|$)/;
// The unknown-product test deliberately requests this and asserts on the 404,
// so it is the assertion rather than a regression.
const EXPECTED_404 = /does-not-exist-12345/;

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForSelector("header", { timeout: 30000 });
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 })
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
      // This script clicks through pages in well under a second, so images the
      // page legitimately preloads are sometimes abandoned before the browser
      // sees them used. Verified against a 7s dwell on the same pages, where the
      // warning does not appear.
      t.includes("was preloaded using link preload but not used")
    ) return;
    problems.push(`[${label}] console.${msg.type()}: ${t.slice(0, 260)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${String(e).slice(0, 260)}`));
  page.on("response", (res) => {
    if (res.status() !== 404) return;
    const p = new URL(res.url()).pathname;
    if (EXPECTED_404.test(p)) return;
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "desktop");

/* 1-2. home -> search for "laptop" */
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);
await page.locator('input[name="q"]').first().fill("laptop");
await page.locator('input[name="q"]').first().press("Enter");
await page.waitForURL(/\/s\?/, { timeout: 30000 });
await settle(page);

/* 3-5. results render with the expected furniture */
const url = page.url();
check("search URL carries q=laptop", /[?&]q=laptop/.test(url), url);

const rows = page.locator("article");
const rowCount = await rows.count();
check("search returns results", rowCount > 0, `${rowCount} rows`);

const firstRow = rows.first();
const rowData = await firstRow.evaluate((el) => ({
  hasImage: !!el.querySelector("img"),
  title: [...el.querySelectorAll("a[href^='/dp/']")].map((a) => a.textContent.trim()).find((t) => t.length > 5) || "",
  hasStars: !!el.querySelector("[role='img'][aria-label*='out of 5']"),
  reviewCount: el.querySelector("a[href*='#reviews']")?.textContent?.trim() || "",
  priceText: el.textContent.match(/\$[\d,]+/)?.[0] || "",
  hasCta: [...el.querySelectorAll("button")].some((b) => /add to cart/i.test(b.textContent)),
  delivery: /FREE delivery/.test(el.textContent),
  href: el.querySelector("a[href^='/dp/']")?.getAttribute("href") || "",
}));
check("result row has image", rowData.hasImage);
check("result row has title", rowData.title.length > 5, rowData.title);
check("result row has star rating", rowData.hasStars);
check("result row has review count", rowData.reviewCount.length > 0, rowData.reviewCount);
check("result row has price", rowData.priceText.startsWith("$"), rowData.priceText);
check("result row has delivery line", rowData.delivery);
check("result row has add-to-cart", rowData.hasCta);
check("result row links to /dp/", rowData.href.startsWith("/dp/"), rowData.href);

const resultCountText = (await page.locator("main p").first().textContent()) || "";
check("result count shown", /results? for/.test(resultCountText), resultCountText.slice(0, 80));
check("filter rail present", (await page.locator('aside[aria-label="Filters"]').count()) === 1);

await page.screenshot({ path: path.join(OUT, "search-desktop.png"), fullPage: false });

/* 6-7. open the first result */
await firstRow.locator("a[href^='/dp/']").first().click();
await page.waitForURL(/\/dp\//, { timeout: 30000 });
await settle(page);
const pdpUrl = page.url();
check("navigated to a PDP", /\/dp\/.+/.test(pdpUrl), pdpUrl);

const pdp = await page.evaluate(() => ({
  h1: document.querySelector("h1")?.textContent?.trim().slice(0, 70) || "",
  thumbs: document.querySelectorAll('[role="tab"]').length,
  buyBoxes: document.querySelectorAll("select[aria-label='Quantity']").length,
  addToCart: [...document.querySelectorAll("button")].filter((b) => /add to cart/i.test(b.textContent)).length,
  buyNow: [...document.querySelectorAll("button")].filter((b) => /buy now/i.test(b.textContent)).length,
  bullets: document.querySelectorAll("ul li").length,
  specRows: document.querySelectorAll("dl div dt").length,
  reviewsHeading: !!document.querySelector("#reviews"),
  histogramBars: document.querySelectorAll("#reviews li span[style*='width']").length,
  related: document.querySelectorAll("a[href^='/dp/']").length,
  breadcrumb: !!document.querySelector('nav[aria-label="Breadcrumb"]'),
  priceText: document.body.textContent.match(/\$[\d,]+/)?.[0] || "",
  stars: !!document.querySelector("[role='img'][aria-label*='out of 5']"),
}));
check("PDP has h1 title", pdp.h1.length > 5, pdp.h1);
check("PDP has breadcrumbs", pdp.breadcrumb);
check("PDP has gallery thumbnails", pdp.thumbs >= 2, `${pdp.thumbs}`);
check("PDP has star rating", pdp.stars);
check("PDP has price", pdp.priceText.startsWith("$"), pdp.priceText);
check("PDP has quantity selector", pdp.buyBoxes >= 1, `${pdp.buyBoxes}`);
check("PDP has Add to Cart", pdp.addToCart >= 1, `${pdp.addToCart}`);
check("PDP has Buy Now", pdp.buyNow >= 1, `${pdp.buyNow}`);
check("PDP has bullets", pdp.bullets >= 3, `${pdp.bullets}`);
check("PDP has spec table", pdp.specRows >= 3, `${pdp.specRows}`);
check("PDP has reviews section", pdp.reviewsHeading);
check("PDP has rating histogram", pdp.histogramBars >= 5, `${pdp.histogramBars}`);
check("PDP has related products", pdp.related > 5, `${pdp.related} /dp/ links`);

await page.screenshot({ path: path.join(OUT, "pdp-desktop.png"), fullPage: false });
await page.screenshot({ path: path.join(OUT, "pdp-desktop-full.png"), fullPage: true });

/* 8. thumbnail changes the main image */
const mainImg = page.locator("main img").nth(4); // main gallery image follows the thumb rail
const beforeTransform = await page
  .locator('[role="tab"]')
  .first()
  .evaluate(() => {
    const imgs = [...document.querySelectorAll("img")];
    const big = imgs.find((i) => i.sizes && i.sizes.includes("440px"));
    return big ? big.style.transform : "";
  });
await page.locator('[role="tab"]').nth(2).click();
await page.waitForTimeout(500);
const afterTransform = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")];
  const big = imgs.find((i) => i.sizes && i.sizes.includes("440px"));
  return big ? big.style.transform : "";
});
check(
  "thumbnail changes main image",
  beforeTransform !== afterTransform && afterTransform !== "",
  `${beforeTransform} -> ${afterTransform}`
);
void mainImg;

/* 9-11. quantity + add to cart updates header badge */
const cartLabelBefore = (await page.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "";
await page.locator("select[aria-label='Quantity']").first().selectOption("3");
await page.waitForTimeout(250);
const qtyValue = await page.locator("select[aria-label='Quantity']").first().inputValue();
check("quantity selector changes value", qtyValue === "3", qtyValue);

await page.locator("button", { hasText: /^Add to Cart$/i }).first().click();
await page.waitForTimeout(900);
const cartLabelAfter = (await page.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "";
check(
  "add to cart updates header count",
  cartLabelBefore !== cartLabelAfter && /3 items/.test(cartLabelAfter),
  `${cartLabelBefore} -> ${cartLabelAfter}`
);

/* 12-13. related product opens a different PDP */
const relatedHref = await page
  .locator("section a[href^='/dp/']")
  .last()
  .getAttribute("href");
await page.locator("section a[href^='/dp/']").last().click();
await page.waitForURL(/\/dp\//, { timeout: 30000 });
await settle(page);
const relatedUrl = page.url();
check(
  "related product opens its own PDP",
  relatedUrl.includes(relatedHref ?? "@@") && relatedUrl !== pdpUrl,
  `${relatedHref} -> ${relatedUrl}`
);

/* 14-15. refresh the PDP */
await page.reload({ waitUntil: "domcontentloaded" });
await settle(page);
const afterReload = await page.evaluate(() => ({
  h1: !!document.querySelector("h1"),
  cart: document.querySelector('a[href="/cart"]')?.getAttribute("aria-label") || "",
}));
check("PDP survives a refresh", afterReload.h1, page.url());
check("cart persists across refresh", /3 items/.test(afterReload.cart), afterReload.cart);

/* 16. nonexistent product id */
const resp = await page.goto(`${BASE}/dp/does-not-exist-12345`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const notFoundBody = (await page.locator("body").textContent()) || "";
check(
  "unknown product id shows a not-found page",
  resp?.status() === 404 && /couldn.t find that product/i.test(notFoundBody),
  `status ${resp?.status()}`
);
await page.screenshot({ path: path.join(OUT, "pdp-notfound.png") });

/* 17. empty search */
await page.goto(`${BASE}/s`, { waitUntil: "domcontentloaded" });
await settle(page);
const emptyRows = await page.locator("article").count();
check("empty query browses the catalogue", emptyRows > 0, `${emptyRows} rows`);

/* 18. search with no results */
await page.goto(`${BASE}/s?q=zzzqqqxxnotathing`, { waitUntil: "domcontentloaded" });
await settle(page);
const noResultsBody = (await page.locator("main").textContent()) || "";
check(
  "no-results state renders",
  /No results/i.test(noResultsBody) && (await page.locator("article").count()) === 0,
  noResultsBody.slice(0, 90)
);
await page.screenshot({ path: path.join(OUT, "search-empty.png") });

/* short/edge queries should not explode */
for (const q of ["a", "%20", "laptop%20computer%20with%20a%20very%20long%20query%20string"]) {
  const r = await page.goto(`${BASE}/s?q=${q}`, { waitUntil: "domcontentloaded" });
  check(`query "${decodeURIComponent(q)}" returns 200`, r?.status() === 200, `status ${r?.status()}`);
}

/* fuzzy match still finds things */
await page.goto(`${BASE}/s?q=labtop`, { waitUntil: "domcontentloaded" });
await settle(page);
check("fuzzy search tolerates a typo", (await page.locator("article").count()) > 0);

await ctx.close();

/* 19. mobile */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attach(mpage, "mobile-390");
await mpage.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
const mOverflow = await mpage.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check("mobile search: no horizontal overflow", mOverflow.sw <= mOverflow.cw + 1, JSON.stringify(mOverflow));
await mpage.screenshot({ path: path.join(OUT, "search-mobile.png"), fullPage: false });

const mHref = await mpage.locator("article a[href^='/dp/']").first().getAttribute("href");
await mpage.goto(`${BASE}${mHref}`, { waitUntil: "domcontentloaded" });
await settle(mpage);
const mPdpOverflow = await mpage.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
check("mobile PDP: no horizontal overflow", mPdpOverflow.sw <= mPdpOverflow.cw + 1, JSON.stringify(mPdpOverflow));
const mBuyBox = await mpage.locator("select[aria-label='Quantity']").count();
check("mobile PDP shows the buy box once", mBuyBox === 1, `${mBuyBox} quantity selectors visible in DOM`);
await mpage.screenshot({ path: path.join(OUT, "pdp-mobile.png"), fullPage: false });
await mctx.close();

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nroutesNotBuiltYet: ${[...missingRoutes].sort().join(", ") || "(none)"}`);
console.log(`\nproblems (${problems.length}):`);
for (const p of problems) console.log(`  - ${p}`);
process.exitCode = problems.length > 0 ? 1 : 0;
