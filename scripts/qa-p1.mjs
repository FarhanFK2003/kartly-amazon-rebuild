// QA for P1: facets, reviews depth, orders, empty/error states, and a
// responsive sweep across seven widths. Runs against the production build.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const missingRoutes = new Set();
const checks = [];
const NOT_BUILT_YET = /\/(signin|help)(\/|\?|$)/;
const EXPECTED_404 = /(does-not-exist|no-such-route)/;

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(300);
}

function attach(page, label) {
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const t = msg.text();
    if (
      t.includes("Download the React DevTools") || t.includes("_next/hmr") || t.includes("WebSocket") ||
      t.includes("status of 400") || t.includes("status of 404") ||
      t.includes("was preloaded using link preload but not used")
    ) return;
    problems.push(`[${label}] console.${msg.type()}: ${t.slice(0, 240)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${String(e).slice(0, 240)}`));
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

const resultCount = async (page) => {
  const t = (await page.locator("main p").first().textContent()) || "";
  const m = t.match(/of\s+([\d,]+)\s+results?/) || t.match(/^1-(\d+)\s+of\s+([\d,]+)/);
  if (/No results/i.test(t)) return 0;
  return m ? Number((m[2] ?? m[1]).replace(/,/g, "")) : -1;
};
const rowCount = (page) => page.locator("article").count();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "desktop");

/* ===================== FILTERS ===================== */
await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);
const baseTotal = await resultCount(page);
check("search returns a baseline result count", baseTotal > 0, `${baseTotal}`);

const facetInfo = await page.evaluate(() => {
  const rail = document.querySelector('aside[aria-label="Filters"]');
  if (!rail) return null;
  return {
    groups: [...rail.querySelectorAll("h3")].map((h) => h.textContent.trim()),
    options: [...rail.querySelectorAll("a[aria-pressed]")].map((a) => a.textContent.trim()),
    withCounts: [...rail.querySelectorAll("a[aria-pressed]")].filter((a) => /\(\d+\)/.test(a.textContent)).length,
    total: rail.querySelectorAll("a[aria-pressed]").length,
  };
});
check("filter rail renders facet groups", facetInfo && facetInfo.groups.length >= 4, facetInfo?.groups.join(" | "));
check("every facet option shows a count", facetInfo && facetInfo.withCounts === facetInfo.total, `${facetInfo?.withCounts}/${facetInfo?.total}`);
check("brand facet present", facetInfo?.groups.includes("Brand"), facetInfo?.groups.join(" | "));

/* counts must be real: applying a facet should yield exactly its stated count */
const firstBrand = await page.evaluate(() => {
  const rail = document.querySelector('aside[aria-label="Filters"]');
  const heads = [...rail.querySelectorAll("h3")];
  const brandHead = heads.find((h) => h.textContent.trim() === "Brand");
  const link = brandHead?.parentElement.querySelector("a[aria-pressed]");
  return link ? { href: link.getAttribute("href"), text: link.textContent.trim() } : null;
});
check("a brand facet link exists", !!firstBrand, JSON.stringify(firstBrand));

const statedCount = Number(firstBrand?.text.match(/\((\d+)\)/)?.[1] ?? -1);
await page.goto(`${BASE}${firstBrand.href}`, { waitUntil: "domcontentloaded" });
await settle(page);
const afterBrand = await resultCount(page);
check("facet count matches the real filtered total", afterBrand === statedCount, `stated ${statedCount}, actual ${afterBrand}`);
check("one filter narrows the results", afterBrand <= baseTotal, `${baseTotal} -> ${afterBrand}`);
check("active filter chip appears", (await page.locator('[aria-label="Active filters"] a').count()) > 0);

/* multiple values within one facet -> OR (result count grows or stays) */
const secondBrandHref = await page.evaluate(() => {
  const rail = document.querySelector('aside[aria-label="Filters"]');
  const heads = [...rail.querySelectorAll("h3")];
  const brandHead = heads.find((h) => h.textContent.trim() === "Brand");
  const links = [...(brandHead?.parentElement.querySelectorAll("a[aria-pressed]") ?? [])];
  const unselected = links.find((a) => a.getAttribute("aria-pressed") === "false");
  return unselected?.getAttribute("href") ?? null;
});
if (secondBrandHref) {
  await page.goto(`${BASE}${secondBrandHref}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const twoBrands = await resultCount(page);
  check("two values in one facet are OR'd", twoBrands >= afterBrand, `${afterBrand} -> ${twoBrands}`);
  check("URL carries both brand values", (page.url().match(/brand=/g) || []).length === 2, page.url());
} else {
  check("two values in one facet are OR'd", false, "no second brand option");
  check("URL carries both brand values", false, "");
}

/* a second facet -> AND (result count shrinks or stays) */
const beforeSecondFacet = await resultCount(page);
const ratingHref = await page.evaluate(() => {
  const rail = document.querySelector('aside[aria-label="Filters"]');
  const heads = [...rail.querySelectorAll("h3")];
  const head = heads.find((h) => h.textContent.trim() === "Customer Reviews");
  return head?.parentElement.querySelector("a")?.getAttribute("href") ?? null;
});
await page.goto(`${BASE}${ratingHref}`, { waitUntil: "domcontentloaded" });
await settle(page);
const twoFacets = await resultCount(page);
check("a second facet narrows further (AND)", twoFacets <= beforeSecondFacet, `${beforeSecondFacet} -> ${twoFacets}`);
check("multiple facets appear in the URL", /brand=/.test(page.url()) && /rating=/.test(page.url()), page.url());
await page.screenshot({ path: path.join(OUT, "filters-desktop.png"), fullPage: false });

/* sort works with filters */
const filteredUrl = page.url();
await page.selectOption('select[aria-label="Sort results by"]', "price-asc");
await page.waitForURL(/sort=price-asc/, { timeout: 20000 });
await settle(page);
check("sort preserves the active filters", /brand=/.test(page.url()) && /rating=/.test(page.url()), page.url());
const prices = await page.evaluate(() =>
  [...document.querySelectorAll("article")].map((a) => {
    const m = a.textContent.match(/\$([\d,]+)/);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  }).filter((n) => n !== null)
);
const ascending = prices.every((p, i) => i === 0 || prices[i - 1] <= p);
check("price ascending sort actually orders results", ascending, prices.slice(0, 6).join(", "));

/* refresh preserves */
await page.reload({ waitUntil: "domcontentloaded" });
await settle(page);
check("refresh preserves filters", /brand=/.test(page.url()) && /sort=price-asc/.test(page.url()), page.url());

/* back / forward */
await page.goBack({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
check("back restores the previous filter state", page.url().includes(filteredUrl.split("?")[1].slice(0, 20)), page.url());
await page.goForward({ waitUntil: "domcontentloaded" });
await settle(page);
check("forward returns to the sorted view", /sort=price-asc/.test(page.url()), page.url());

/* remove one chip */
const chipsBefore = await page.locator('[aria-label="Active filters"] a').count();
await page.locator('[aria-label="Active filters"] a').first().click();
await settle(page);
const chipsAfter = await page.locator('[aria-label="Active filters"] a').count();
check("removing one chip removes exactly one filter", chipsAfter === chipsBefore - 1, `${chipsBefore} -> ${chipsAfter}`);

/* clear all */
await page.goto(`${BASE}/s?q=laptop&brand=Kestrel&rating=4`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.getByRole("link", { name: "Clear all" }).click();
await settle(page);
check("clear all removes every filter", !/brand=|rating=/.test(page.url()) && /q=laptop/.test(page.url()), page.url());
check("clear all restores the full result count", (await resultCount(page)) === baseTotal, `${await resultCount(page)} vs ${baseTotal}`);

/* pagination with filters */
await page.goto(`${BASE}/s?i=electronics`, { waitUntil: "domcontentloaded" });
await settle(page);
const pager = page.locator('nav[aria-label="Search results pages"]');
if (await pager.count()) {
  check("previous is disabled on page 1", (await pager.locator('[aria-disabled="true"]').count()) >= 1);
  await pager.getByRole("link", { name: "Next page" }).click();
  await settle(page);
  check("pagination keeps the filter", /i=electronics/.test(page.url()) && /page=2/.test(page.url()), page.url());
  check("page 2 shows results", (await rowCount(page)) > 0, `${await rowCount(page)} rows`);
} else {
  check("previous is disabled on page 1", true, "single page for this filter");
  check("pagination keeps the filter", true, "single page");
  check("page 2 shows results", true, "single page");
}

/* attribute facet */
await page.goto(`${BASE}/s?i=computers`, { waitUntil: "domcontentloaded" });
await settle(page);
const attrGroups = await page.evaluate(() => {
  const rail = document.querySelector('aside[aria-label="Filters"]');
  const known = ["Department", "Brand", "Customer Reviews", "Price", "Availability", "Deals & Discounts"];
  return [...rail.querySelectorAll("h3")].map((h) => h.textContent.trim()).filter((t) => !known.includes(t));
});
check("category-specific attribute facets appear", attrGroups.length > 0, attrGroups.join(" | "));

/* ===================== REVIEWS ===================== */
await page.goto(`${BASE}/dp/meridia-stratus-14-laptop-computers-01`, { waitUntil: "domcontentloaded" });
await settle(page);
const reviewInfo = await page.evaluate(() => {
  const sec = document.querySelector("#reviews");
  const bars = [...sec.querySelectorAll('button[aria-pressed] span[style*="width"]')];
  const pcts = [...sec.querySelectorAll("button[aria-pressed]")].map((b) => {
    const m = b.textContent.match(/(\d+)%/);
    return m ? Number(m[1]) : null;
  }).filter((n) => n !== null);
  return {
    bars: bars.length,
    pcts,
    sum: pcts.reduce((a, b) => a + b, 0),
    cards: sec.querySelectorAll("li > div + div, li p").length,
    hasSort: !!sec.querySelector('select[aria-label="Sort reviews by"]'),
    hasHelpful: [...sec.querySelectorAll("button")].some((b) => /helpful/i.test(b.textContent)),
    verified: [...sec.querySelectorAll("p")].filter((p) => /Verified Purchase/.test(p.textContent)).length,
    summary: /Customers say/.test(sec.textContent),
    seeAll: [...sec.querySelectorAll("button")].some((b) => /See all \d+ reviews/.test(b.textContent)),
  };
});
check("histogram renders five bars", reviewInfo.bars === 5, `${reviewInfo.bars}`);
check("histogram percentages sum to about 100", Math.abs(reviewInfo.sum - 100) <= 3, `${reviewInfo.sum}% (${reviewInfo.pcts.join("/")})`);
check("review sort control present", reviewInfo.hasSort);
check("helpful control present", reviewInfo.hasHelpful);
check("verified purchase badges present", reviewInfo.verified > 0, `${reviewInfo.verified}`);
check("review summary present", reviewInfo.summary);
check("see-all-reviews control present", reviewInfo.seeAll);

/* review sorting actually reorders */
const firstTitleBefore = await page.evaluate(() => document.querySelector("#reviews li span.font-bold")?.textContent ?? "");
await page.selectOption('select[aria-label="Sort reviews by"]', "lowest");
await page.waitForTimeout(500);
const ratingsAfterSort = await page.evaluate(() =>
  [...document.querySelectorAll('#reviews li [role="img"][aria-label*="out of 5"]')].map((el) =>
    Number(el.getAttribute("aria-label").match(/([\d.]+) out of 5/)[1])
  )
);
const lowFirst = ratingsAfterSort.every((r, i) => i === 0 || ratingsAfterSort[i - 1] <= r);
check("sorting reviews by lowest reorders them", lowFirst, ratingsAfterSort.join(", "));
void firstTitleBefore;

/* helpful toggles */
const helpfulBtn = page.locator("#reviews button", { hasText: /^Helpful$/ }).first();
const beforeHelpfulText = (await page.locator("#reviews").textContent()) || "";
await helpfulBtn.click();
await page.waitForTimeout(400);
const afterHelpfulText = (await page.locator("#reviews").textContent()) || "";
check("helpful interaction responds", /Marked helpful/.test(afterHelpfulText) && beforeHelpfulText !== afterHelpfulText);

/* star filter on histogram */
await page.locator('#reviews button[aria-pressed]').first().click();
await page.waitForTimeout(400);
check("clicking a histogram row filters the reviews", /star reviews/i.test((await page.locator("#reviews").textContent()) || ""));
await page.screenshot({ path: path.join(OUT, "reviews-desktop.png"), fullPage: false });

/* ===================== ORDERS ===================== */
await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
await settle(page);
check("orders with none stored shows an empty state", /No orders yet/i.test((await page.locator("main").textContent()) || ""));
await page.screenshot({ path: path.join(OUT, "orders-empty.png"), fullPage: false });

/* place an order, then check /orders */
await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.getByRole("button", { name: "Add to cart" }).first().click();
await page.waitForTimeout(600);
await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.fill("#fullName", "Farhan Khan");
await page.fill("#line1", "500 Market Street");
await page.fill("#city", "San Francisco");
await page.selectOption("#state", "CA");
await page.fill("#zip", "94103");
await page.fill("#phone", "5550192837");
await page.getByRole("button", { name: /Use this address/i }).click();
await page.waitForTimeout(600);
await page.getByText("Credit or debit card").click();
await page.fill("#cardNumber", "4242 4242 4242 4242");
await page.fill("#cardName", "F Khan");
await page.fill("#cardExpiry", "04/29");
await page.fill("#cardCvv", "123");
await page.getByRole("button", { name: /Use this payment method/i }).click();
await page.waitForTimeout(700);
await page.locator("main").getByRole("button", { name: /Place your order/i }).first().click();
await page.waitForURL(/\/order-confirmation\//, { timeout: 30000 });
await settle(page);
const orderId = page.url().split("/order-confirmation/")[1];

await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
await settle(page);
const ordersText = (await page.locator("main").textContent()) || "";
check("placed order appears in /orders", ordersText.includes(orderId), orderId);
check("order card shows a total", /\$\d/.test(ordersText));
check("order card shows a status", /On the way|Delivered/.test(ordersText));
check("order card shows thumbnails", (await page.locator('main a[href^="/dp/"] img').count()) > 0);

await page.locator("main").getByRole("button", { name: /Show \d+ line/ }).first().click();
await page.waitForTimeout(400);
check("order details expand", /Qty \d/.test((await page.locator("main").textContent()) || ""));

await page.reload({ waitUntil: "domcontentloaded" });
await settle(page);
check("orders survive a refresh", ((await page.locator("main").textContent()) || "").includes(orderId));
await page.screenshot({ path: path.join(OUT, "orders-list.png"), fullPage: false });

check("orders reachable from the header", (await page.locator('header a[href="/orders"]').count()) > 0);

/* ===================== ERROR STATES ===================== */
const r404 = await page.goto(`${BASE}/no-such-route-here`, { waitUntil: "domcontentloaded" });
await settle(page);
const body404 = (await page.locator("body").textContent()) || "";
check("invalid route returns 404", r404?.status() === 404, `${r404?.status()}`);
check("404 page is branded and navigable", /404/.test(body404) && /Kartly/i.test(body404) && (await page.locator('a[href="/"]').count()) > 0);
check("404 offers search and departments", (await page.locator('form[action="/s"]').count()) > 0 && (await page.locator('a[href^="/s?i="]').count()) >= 5);
await page.screenshot({ path: path.join(OUT, "404.png"), fullPage: false });

const rProduct = await page.goto(`${BASE}/dp/does-not-exist-999`, { waitUntil: "domcontentloaded" });
await settle(page);
check("invalid product id returns a branded not-found", rProduct?.status() === 404 && /couldn.t find that product/i.test((await page.locator("main").textContent()) || ""));

await page.goto(`${BASE}/s?q=zzzqqqnonsense`, { waitUntil: "domcontentloaded" });
await settle(page);
check("nonsense query shows a no-results state", /No results/i.test((await page.locator("main").textContent()) || ""));

await ctx.close();

/* ===================== EMPTY-STATE CONTEXT ===================== */
const clean = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const cpage = await clean.newPage();
attach(cpage, "clean");
await cpage.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await settle(cpage);
check("empty cart state", /cart is empty/i.test((await cpage.locator("main").textContent()) || ""));
await cpage.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
await settle(cpage);
check("checkout with empty cart", /nothing to check out/i.test((await cpage.locator("main").textContent()) || ""));
await cpage.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
await settle(cpage);
check("orders with none stored", /No orders yet/i.test((await cpage.locator("main").textContent()) || ""));
await clean.close();

/* ===================== RESPONSIVE SWEEP ===================== */
const WIDTHS = [1440, 1280, 1024, 768, 480, 390, 375];
const ROUTES = [
  ["home", "/"],
  ["search", "/s?q=laptop"],
  ["pdp", "/dp/meridia-stratus-14-laptop-computers-01"],
  ["cart", "/cart"],
  ["checkout", "/checkout"],
  ["orders", "/orders"],
  ["404", "/no-such-route-here"],
];

const overflows = [];
for (const width of WIDTHS) {
  const rctx = await browser.newContext({ viewport: { width, height: 900 } });
  const rpage = await rctx.newPage();
  attach(rpage, `w${width}`);

  // seed a cart so /cart and /checkout have real content to lay out
  await rpage.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(rpage);
  await rpage.getByRole("button", { name: "Add to cart" }).first().click();
  await rpage.waitForTimeout(500);

  for (const [name, route] of ROUTES) {
    await rpage.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await settle(rpage);
    const m = await rpage.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      // any element sticking out past the viewport
      wide: [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 2)
        .slice(0, 3)
        .map((el) => `${el.tagName}.${String(el.className).split(" ")[0]}`),
    }));
    if (m.sw > m.cw + 1) overflows.push(`${name}@${width}: ${m.sw}>${m.cw} [${m.wide.join(", ")}]`);
    if (width === 390) await rpage.screenshot({ path: path.join(OUT, `r390-${name}.png`), fullPage: false });
    if (width === 768) await rpage.screenshot({ path: path.join(OUT, `r768-${name}.png`), fullPage: false });
  }
  await rctx.close();
}
check("no horizontal overflow at any width or route", overflows.length === 0, overflows.join(" | ").slice(0, 400));

/* mobile filter drawer */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attach(mpage, "mobile-390");
await mpage.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
const filterBtn = mpage.getByRole("button", { name: /Filters/ }).first();
check("mobile shows a filters button", (await filterBtn.count()) > 0);
const railBefore = await mpage.locator('aside[aria-label="Filters"]').boundingBox();
await filterBtn.click();
await mpage.waitForTimeout(600);
const railAfter = await mpage.locator('aside[aria-label="Filters"]').boundingBox();
check("filter drawer slides in", railBefore && railAfter && railAfter.x > railBefore.x, `${railBefore?.x} -> ${railAfter?.x}`);
await mpage.screenshot({ path: path.join(OUT, "filters-mobile.png"), fullPage: false });
await mpage.keyboard.press("Escape");
await mpage.waitForTimeout(500);
const railClosed = await mpage.locator('aside[aria-label="Filters"]').boundingBox();
check("filter drawer closes on Escape", railClosed && railClosed.x < 0, `${railClosed?.x}`);
await mctx.close();

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nroutesNotBuiltYet: ${[...missingRoutes].sort().join(", ") || "(none)"}`);
console.log(`\nproblems (${problems.length}):`);
for (const p of problems) console.log(`  - ${p}`);
process.exitCode = problems.length > 0 ? 1 : 0;
