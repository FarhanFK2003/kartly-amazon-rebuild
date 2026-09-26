/**
 * Product discovery: /browse, the results grid, filters, sorting, pagination.
 *
 * Ports the behavioural coverage of scripts/qa-discovery.mjs and the filter /
 * sort / pagination half of scripts/qa-p1.mjs onto the new grid-first
 * interface. See COVERAGE.md for the old-to-new selector mapping.
 *
 * The assertions are about behaviour and URL state, not layout: a filtered,
 * sorted, paginated view must remain one shareable address, and every count
 * must come from the catalogue rather than a fixture.
 *
 *   node scripts/qa/discovery.mjs <output-dir>
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { TID, byTestId, cartCount } from "./selectors.mjs";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
let total = 0;
const check = (name, passed, detail = "") => {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
};
const settle = (page, ms = 600) => page.waitForTimeout(ms);
const cards = (page) => byTestId(page, TID.productCard);

const browser = await chromium.launch();
const errors = [];
const badResponses = [];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`));
/* Set while deliberately navigating to a missing product: the browser logs a
   bare "Failed to load resource ... 404" with no URL, so it cannot be told
   apart from a real one by inspection. */
let expecting404 = false;
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/DevTools|preloaded using link preload/.test(t)) return;
  if (expecting404 && /Failed to load resource/.test(t)) return;
  errors.push(t.slice(0, 140));
});
page.on("response", (r) => {
  if (r.status() === 404 && !/no-such|does-not-exist/.test(r.url())) badResponses.push(r.url().slice(0, 90));
});

/* ---- 1-2. /browse ---------------------------------------------------- */
await page.goto(`${BASE}/browse`, { waitUntil: "domcontentloaded" });
await settle(page, 900);
check("/browse loads", (await page.getByRole("heading", { level: 1 }).count()) === 1);

/* Scoped to the section: an unscoped a[href^='/s?i='] also matches the search
   overlay's department list, which is in the DOM but hidden. */
const deptSection = page.locator("section[aria-labelledby='departments-heading']");
const deptLinks = await deptSection.locator("a[href^='/s?i=']").count();
check("/browse lists every department", deptLinks === 10, `${deptLinks} links`);

const brandLinks = await page.locator("a[href^='/s?brand=']").count();
check("/browse offers brand discovery", brandLinks > 0, `${brandLinks} brand links`);

check("/browse previews real products", (await cards(page).count()) > 0);

/* Counts on the page must be real, not invented. A department link's count
   must match the number of products that department actually returns. */
const firstCard = deptSection.locator("a[href^='/s?i=']").first();
const firstDept = await firstCard.getAttribute("href");
const shownCount = Number((await firstCard.innerText()).match(/(\d+)/)?.[1] ?? NaN);
await page.goto(BASE + firstDept, { waitUntil: "domcontentloaded" });
await settle(page);
const realTotal = Number(((await page.locator("h1 + p").innerText()) || "").match(/of\s+(\d+)/)?.[1] ?? NaN);
check("department counts on /browse match the real result set", shownCount === realTotal, `${shownCount} vs ${realTotal}`);

/* ---- 3-6. grid + search ---------------------------------------------- */
await page.goto(`${BASE}/s`, { waitUntil: "domcontentloaded" });
await settle(page);
check("the results grid renders", await byTestId(page, TID.productGrid).isVisible());
const gridCount = await cards(page).count();
check("the grid is paginated to a page of products", gridCount > 0 && gridCount <= 16, `${gridCount}`);

await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded" });
await settle(page);
check("a search query returns results", (await cards(page).count()) > 0);
check("the query stays in the URL", page.url().includes("q=laptop"), page.url());
check("the query is stated on the page", /laptop/i.test(await page.getByRole("heading", { level: 1 }).innerText()));

/* ---- 7-11. filters ---------------------------------------------------- */
/* Each filter is exercised through the UI, then the URL is asserted - the URL
   is the source of truth, so a filter that only changes React state fails. */

// department, via the facet bar
await page.goto(`${BASE}/s`, { waitUntil: "domcontentloaded" });
await settle(page);
const beforeFilter = await resultTotal(page);
await byTestId(page, TID.facetChip).first().click();
await settle(page, 300);
await byTestId(page, TID.facetOption).first().click();
await page.waitForURL(/i=/, { timeout: 10000 });
await settle(page);
check("department filtering writes i= to the URL", /[?&]i=/.test(page.url()), page.url());
const afterFilter = await resultTotal(page);
check("department filtering narrows the result set", afterFilter < beforeFilter, `${beforeFilter} -> ${afterFilter}`);
check("an applied filter is shown as a removable chip", (await byTestId(page, TID.activeFilterChip).count()) > 0);

// removing it restores the wider set
await byTestId(page, TID.activeFilterChip).first().click();
/* Wait for the filter to actually leave the URL, then for the re-render. The
   result set is now recounted by the database, not by an in-memory filter. */
await page.waitForURL((u) => !/[?&]i=/.test(u.toString()), { timeout: 15000 }).catch(() => {});
await page.waitForLoadState("networkidle");
await settle(page, 300);
check("removing the chip restores the result set", (await resultTotal(page)) === beforeFilter);

for (const [label, url, param] of [
  ["brand", "/s?brand=Kestrel", "brand=Kestrel"],
  ["rating", "/s?rating=4", "rating=4"],
  ["price", "/s?price=25-50", "price=25-50"],
  ["deals", "/s?deals=1", "deals=1"],
]) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await settle(page, 500);
  const n = await resultTotal(page);
  check(`${label} filtering works`, Number.isFinite(n) && n > 0 && n < 120, `${n} results`);
  check(`${label} survives in the URL`, page.url().includes(param), page.url());
}

/* Availability is asserted differently on purpose. Every product in this
   catalogue has stock, so "in stock only" correctly returns all 120 - it
   applies, it just excludes nothing. Asserting that it narrows would be
   asserting a fact about the data rather than the filter. */
await page.goto(`${BASE}/s?avail=1`, { waitUntil: "domcontentloaded" });
await settle(page, 500);
const availTotal = await resultTotal(page);
const inStock = await page.evaluate(() => !/Out of stock/.test(document.body.textContent || ""));
check("availability filtering applies", page.url().includes("avail=1") && Number.isFinite(availTotal) && availTotal > 0,
  `${availTotal} results`);
check("availability filtering excludes out-of-stock products", inStock);

// two filters combine
await page.goto(`${BASE}/s?i=electronics&brand=Aureon`, { waitUntil: "domcontentloaded" });
await settle(page, 500);
const combined = await resultTotal(page);
check("multiple filters combine", Number.isFinite(combined) && combined > 0 && combined < 12, `${combined}`);
check("both applied filters show as chips", (await byTestId(page, TID.activeFilterChip).count()) === 2);

/* ---- 12. sorting ------------------------------------------------------ */
await page.goto(`${BASE}/s?i=electronics`, { waitUntil: "domcontentloaded" });
await settle(page);
await byTestId(page, TID.sortControl).click();
await settle(page, 300);
await page.getByRole("menuitem", { name: /Price: Low to High/i }).click();
await page.waitForURL(/sort=price-asc/, { timeout: 10000 });
await settle(page);
check("sorting writes sort= to the URL", page.url().includes("sort=price-asc"), page.url());

const prices = await readPrices(page);
const ascending = prices.every((v, i, a) => i === 0 || a[i - 1] <= v);
check("price ascending actually orders the grid", ascending, prices.slice(0, 5).join(", "));

await page.goto(`${BASE}/s?i=electronics&sort=price-desc`, { waitUntil: "domcontentloaded" });
await settle(page);
const desc = await readPrices(page);
check("price descending orders the other way", desc.every((v, i, a) => i === 0 || a[i - 1] >= v), desc.slice(0, 5).join(", "));

/* ---- 13-15. pagination and state survival ----------------------------- */
await page.goto(`${BASE}/s?sort=price-asc&rating=4`, { waitUntil: "domcontentloaded" });
await settle(page);
const pager = byTestId(page, TID.pagination);
check("pagination renders when there is more than one page", await pager.isVisible());

const page1Titles = await cardTitles(page);
await pager.getByRole("link", { name: "Page 2" }).click();
await page.waitForURL(/page=2/, { timeout: 10000 });
await settle(page);
check("pagination navigates to page 2", page.url().includes("page=2"), page.url());
check("page 2 shows different products", (await cardTitles(page))[0] !== page1Titles[0]);
check("filters survive pagination", page.url().includes("rating=4"), page.url());
check("sort survives pagination", page.url().includes("sort=price-asc"), page.url());

await page.goBack();
await settle(page, 700);
check("browser back returns to page 1", !page.url().includes("page=2"), page.url());

/* ---- 18-19. product links and add to cart ------------------------------ */
await page.goto(`${BASE}/s?i=electronics`, { waitUntil: "domcontentloaded" });
await settle(page);
const before = (await cartCount(page)) ?? 0;
await byTestId(page, TID.addToCart).first().click();
await settle(page, 700);
check("add to cart works from a card", (await cartCount(page)) === before + 1, `${before} -> ${await cartCount(page)}`);

await page.keyboard.press("Escape");
await settle(page, 400);
const href = await byTestId(page, TID.productCardTitle).first().getAttribute("href");
check("card titles link to a product page", (href || "").startsWith("/dp/"), String(href));
const pdp = await page.goto(BASE + href, { waitUntil: "domcontentloaded" });
check("the linked product page resolves", pdp.status() === 200, String(pdp.status()));

expecting404 = true;
const missing = await page.goto(`${BASE}/dp/does-not-exist-12345`, { waitUntil: "domcontentloaded" });
check("an unknown product still 404s", missing.status() === 404, String(missing.status()));
await settle(page, 300);
expecting404 = false;

await ctx.close();

/* ---- 16-17, 23. mobile filter and sort -------------------------------- */
for (const width of [390, 430, 768]) {
  const mctx = await browser.newContext({
    viewport: { width, height: 880 },
    isMobile: width <= 480,
    hasTouch: width <= 480,
  });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(`[${width}] ${String(e).slice(0, 140)}`));
  const w = `@${width}`;

  await mp.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded" });
  await settle(mp, 800);

  check(`${w} exactly one filter sheet in the DOM`, (await byTestId(mp, TID.filterSheet).count()) === 1);
  check(`${w} the facet bar is not shown on narrow widths`, !(await byTestId(mp, TID.facetBar).isVisible()));

  const trigger = byTestId(mp, TID.filterSheetTrigger);
  check(`${w} the filter trigger is visible`, await trigger.isVisible());
  await trigger.click();
  await settle(mp, 600);

  const sheet = byTestId(mp, TID.filterSheet);
  check(`${w} the filter sheet opens`, await sheet.isVisible());
  const box = await sheet.boundingBox();
  check(`${w} the sheet fills the viewport height`, !!box && box.height >= 700, box ? `${Math.round(box.height)}px` : "no box");
  check(`${w} the sheet carries real facet options`, (await sheet.locator(`[data-testid="${TID.facetOption}"]`).count()) > 0);
  check(`${w} the trigger reports expanded`, (await trigger.getAttribute("aria-expanded")) === "true");

  await mp.keyboard.press("Escape");
  await settle(mp, 500);
  check(`${w} Escape closes the sheet`, !(await sheet.isVisible()));
  check(`${w} focus returns to the filter trigger`, await trigger.evaluate((el) => el === document.activeElement));

  // applying a filter from the sheet navigates and keeps URL state
  await trigger.click();
  await settle(mp, 500);
  await sheet.locator(`[data-testid="${TID.facetOption}"]`).first().click();
  await mp.waitForURL(/[?&](i|brand|price|rating|deals|avail)=/, { timeout: 10000 });
  await settle(mp, 600);
  check(`${w} a filter applied from the sheet reaches the URL`, /[?&](i|brand|price|rating|deals|avail)=/.test(mp.url()), mp.url());
  check(`${w} the sheet closes after applying`, !(await sheet.isVisible()));

  // sort is reachable on touch
  const sort = byTestId(mp, TID.sortControl);
  check(`${w} the sort control is visible`, await sort.isVisible());
  await sort.click();
  await settle(mp, 400);
  check(`${w} the sort menu opens`, await mp.getByRole("menu", { name: /Sort results by/i }).isVisible());
  await mp.keyboard.press("Escape");
  await settle(mp, 300);

  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  check(`${w} no horizontal overflow`, sw <= width + 1, `${sw}`);

  if (width === 390) await mp.screenshot({ path: path.join(OUT, "mobile-discovery.png") });
  await mctx.close();
}

await browser.close();

check("no unexpected 404 responses", badResponses.length === 0, badResponses.slice(0, 3).join(" | "));
check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

console.log(`\n${total - problems.length}/${total} discovery checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}

/* ---------------------------------------------------------------- helpers */

async function resultTotal(p) {
  const text = (await p.locator("h1 + p").innerText()) || "";
  const m = /of\s+([\d,]+)/.exec(text) || /^(\d+)/.exec(text);
  return m ? Number(m[1].replace(/,/g, "")) : NaN;
}

async function readPrices(p) {
  return p.evaluate((tid) => {
    return [...document.querySelectorAll(`[data-testid="${tid}"]`)].map((el) => {
      const m = /([\d,]+\.\d{2})/.exec(el.textContent || "");
      return m ? Number(m[1].replace(/,/g, "")) : NaN;
    });
  }, TID.productCardPrice);
}

async function cardTitles(p) {
  return p.evaluate(
    (tid) => [...document.querySelectorAll(`[data-testid="${tid}"]`)].map((el) => el.textContent?.trim()),
    TID.productCardTitle
  );
}
