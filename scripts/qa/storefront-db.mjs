/**
 * The storefront, against PostgreSQL.
 *
 * Wave 6B moved the customer-facing pages off the static catalogue and onto the
 * database. The other suites check that those pages still behave; this one
 * checks that the data they are showing actually comes from the database.
 *
 * The check that matters is the last one. It changes a product's title and
 * price directly in PostgreSQL, loads the real product page in a real browser,
 * and requires the rendered HTML to show the changed values - then restores the
 * row and requires the page to show the originals again. Nothing reading a
 * file can pass that.
 *
 *   node scripts/qa/storefront-db.mjs <output-dir>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TID, byTestId } from "./selectors.mjs";
import { startQaSession } from "./qa-session.mjs";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
let total = 0;
const check = (name, passed, detail = "") => {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
};

for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/* The add-to-cart check creates a cart row; the QA session makes it
   identifiable and guarantees it is purged afterwards. */
const qa = await startQaSession("storefront", BASE);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([qa.cookie]);
const page = await ctx.newPage();

const errors = [];
const badResponses = [];
let expecting404 = false;
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`));
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|did not match|Text content does not match/i.test(t)) errors.push(`HYDRATION: ${t.slice(0, 160)}`);
  if (m.type() !== "error") return;
  if (/DevTools|preloaded using link preload/.test(t)) return;
  // The not-found assertion navigates to a URL that must 404; the browser logs
  // a resource error for it, which is the expected result, not a defect.
  if (/Failed to load resource/.test(t) && /404/.test(t) && expecting404) return;
  errors.push(t.slice(0, 140));
});
page.on("response", (r) => {
  if (r.status() === 404 && !/definitely-not|__nonexistent/.test(r.url())) {
    badResponses.push(r.url().slice(0, 90));
  }
});

const go = (url) => page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
const cards = () => byTestId(page, TID.productCard);

/* ---- database facts the assertions are measured against --------------- */

const dbProductCount = await prisma.product.count();
const dbCategoryCount = await prisma.category.count();
const dbBrandCount = await prisma.brand.count();
const topSeller = await prisma.product.findFirst({
  orderBy: { reviewCount: "desc" },
  include: { brand: { select: { name: true } } },
});
const electronicsCount = await prisma.product.count({ where: { categoryId: "electronics" } });

/* ---- 1-2. homepage ----------------------------------------------------- */

await go("/");
check("1. the homepage loads", (await page.locator("main").count()) === 1);

const homeText = await page.locator("body").innerText();
check(
  "2. homepage figures come from the database",
  homeText.includes(String(dbProductCount)) && (await cards().count()) > 0,
  `expected ${dbProductCount} products referenced; ${await cards().count()} cards`
);

/*
  Every product the homepage renders must be a row in the database.

  An earlier version of this check looked for the single best-reviewed product,
  assuming a "most reviewed" shelf. There is no such shelf - the homepage ranks
  by rating, by discount and by badge - so it was asserting something the page
  never claimed. Checking that the titles it does render all exist in the
  database tests the same thing and is actually true of the page.
*/
const homeTitles = await byTestId(page, TID.productCardTitle).allInnerTexts();
const homeMatches = await prisma.product.count({
  where: { title: { in: homeTitles.map((t) => t.trim()) } },
});
check(
  "3. every product rendered on the homepage is a database row",
  homeTitles.length > 0 && homeMatches === new Set(homeTitles.map((t) => t.trim())).size,
  `${homeTitles.length} rendered, ${homeMatches} matched in the database`
);

/* ---- 4-5. browse ------------------------------------------------------- */

await go("/browse");
check("4. /browse loads", (await page.locator("main").count()) === 1);

const browseText = await page.locator("body").innerText();
check(
  "5. browse counts and brands match the database",
  browseText.includes(String(dbProductCount)) &&
    browseText.includes(String(dbCategoryCount)) &&
    browseText.includes(String(dbBrandCount)),
  `products=${dbProductCount} departments=${dbCategoryCount} brands=${dbBrandCount}`
);

/* ---- 6-7. search ------------------------------------------------------- */

await go("/s");
check("6. /s loads", (await page.locator("main").count()) === 1);
const allText = await page.locator("body").innerText();
check(
  "7. browsing everything reports the database total",
  allText.includes(String(dbProductCount)),
  `expected ${dbProductCount}`
);

await go("/s?q=headphones");
check("8. a text search returns results", (await cards().count()) > 0);

/* ---- 9-14. facets ------------------------------------------------------ */

await go("/s?i=electronics");
const catCount = await cards().count();
const catText = await page.locator("body").innerText();
check(
  "9. category filtering matches the database count",
  catText.includes(String(electronicsCount)),
  `db says ${electronicsCount}, page shows ${catCount} cards`
);

const brandName = topSeller.brand.name;
await go(`/s?brand=${encodeURIComponent(brandName)}`);
const dbBrandProducts = await prisma.product.count({
  where: { brand: { name: brandName } },
});
const brandText = await page.locator("body").innerText();
check(
  "10. brand filtering matches the database count",
  brandText.includes(String(dbBrandProducts)),
  `${brandName}: db says ${dbBrandProducts}`
);

await go("/s?price=0-25");
const dbCheap = await prisma.product.count({ where: { price: { gte: 0, lt: 2500 } } });
check(
  "11. price filtering matches the database count",
  (await page.locator("body").innerText()).includes(String(dbCheap)),
  `db says ${dbCheap}`
);

await go("/s?rating=4");
const dbRated = await prisma.product.count({ where: { rating: { gte: 4 } } });
check(
  "12. rating filtering matches the database count",
  (await page.locator("body").innerText()).includes(String(dbRated)),
  `db says ${dbRated}`
);

await go("/s?deals=1");
const dbDeals = await prisma.product.count({ where: { dealPercent: { gt: 0 } } });
check(
  "13. the deals filter matches the database count",
  (await page.locator("body").innerText()).includes(String(dbDeals)),
  `db says ${dbDeals}`
);

await go("/s?avail=1");
const dbInStock = await prisma.product.count({ where: { stock: { gt: 0 } } });
check(
  "14. the availability filter matches the database count",
  (await page.locator("body").innerText()).includes(String(dbInStock)),
  `db says ${dbInStock}`
);

/* ---- 15-16. sorting and pagination ------------------------------------- */

await go("/s?sort=price-asc");
const prices = await byTestId(page, TID.productCardPrice).allInnerTexts();
// A discounted card renders the current price and the struck-through list
// price in the same cell, separated by a newline, so take the first figure only.
const asNumber = (t) => Number((t.match(/[\d.]+/) ?? ["0"])[0]);
const ascending = prices.every((p, i) => i === 0 || asNumber(prices[i - 1]) <= asNumber(p));
check("15. price-ascending sort is ordered", ascending, prices.slice(0, 4).join(" "));

const dbCheapest = await prisma.product.findFirst({ orderBy: { price: "asc" } });
check(
  "16. the first sorted result is the database's cheapest product",
  Math.abs(asNumber(prices[0]) * 100 - dbCheapest.price) < 100,
  `page ${prices[0]} vs db ${dbCheapest.price}`
);

await go("/s?page=2");
const pageTwo = await cards().count();
check("17. pagination renders a second page", pageTwo > 0, `${pageTwo} cards`);
check("18. the page parameter survives in the URL", page.url().includes("page=2"), page.url());

await go("/s?q=laptop&i=computers&sort=price-desc&page=1");
const url = page.url();
check(
  "19. multiple URL parameters are all preserved",
  url.includes("q=laptop") && url.includes("i=computers") && url.includes("sort=price-desc"),
  url
);

/* ---- 20-24. product detail --------------------------------------------- */

const probe = await prisma.product.findFirst({
  orderBy: { position: "asc" },
  include: { variants: true, reviews: true, category: true },
});

await go(`/dp/${probe.slug}`);
check("20. a valid product page loads", (await page.locator("h1").count()) === 1);
const pdpText = await page.locator("body").innerText();
check(
  "21. the product page shows the database title",
  pdpText.includes(probe.title.split(",")[0]),
  probe.title.slice(0, 40)
);

check(
  "22. variants from the database are rendered",
  probe.variants.length === 0 || pdpText.includes(probe.variants[0].label),
  `${probe.variants.length} variants; first "${probe.variants[0]?.label}"`
);

check(
  "23. reviews from the database are rendered",
  probe.reviews.length === 0 ||
    (await byTestId(page, TID.pdpReviews).count()) > 0,
  `${probe.reviews.length} reviews`
);

const imgOk = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("main img")];
  return imgs.length > 0 && imgs.every((i) => i.complete === false || i.naturalWidth > 0);
});
check("24. product images load", imgOk);

expecting404 = true;
const notFound = await page.goto(`${BASE}/dp/__nonexistent-product__`, { waitUntil: "networkidle" });
check("25. an unknown product returns not-found", notFound.status() === 404, `${notFound.status()}`);
expecting404 = false;

/* ---- 26. add to cart still works ---------------------------------------- */

await go(`/dp/${probe.slug}`);
await byTestId(page, TID.pdpAddToCart).first().click();
await page.waitForTimeout(900);
const cartBadge = await page.locator("a[aria-label^='Cart,']").first().getAttribute("aria-label");
check("26. add to cart still works", /[1-9]/.test(cartBadge ?? ""), cartBadge ?? "no badge");

/* ---- 27-28. page health -------------------------------------------------- */

const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check("27. no horizontal overflow", overflow);
check(
  "28. no console, page or hydration errors",
  errors.length === 0,
  errors.slice(0, 3).join(" | ")
);
check("29. no unexpected 404 responses", badResponses.length === 0, badResponses.slice(0, 3).join(" | "));

/* ---- 30-33. the proof: change PostgreSQL, watch the storefront change ---- */

/*
  The acceptance test for this wave.

  Everything above could in principle be satisfied by a static file that happens
  to agree with the database. This cannot: the row is changed, the page is
  loaded in a browser, and the rendered output has to follow.
*/
const original = { title: probe.title, price: probe.price };
const marker = `WAVE6B PROOF ${Date.now()}`;
const newPrice = original.price + 4321;

try {
  await prisma.product.update({
    where: { id: probe.id },
    data: { title: marker, price: newPrice },
  });

  await go(`/dp/${probe.slug}`);
  const mutated = await page.locator("body").innerText();
  check(
    "30. the STOREFRONT shows a change made directly in PostgreSQL",
    mutated.includes(marker),
    mutated.slice(0, 80).replace(/\s+/g, " ")
  );

  const expectedPrice = (newPrice / 100).toFixed(2);
  check(
    "31. the storefront shows the changed price",
    mutated.includes(expectedPrice),
    `expected ${expectedPrice}`
  );

  const apiBody = await (await fetch(`${BASE}/api/products/${probe.id}`)).json();
  check(
    "32. the API returns the same changed values",
    apiBody?.product?.title === marker && apiBody?.product?.price === newPrice,
    `${apiBody?.product?.title} / ${apiBody?.product?.price}`
  );
} finally {
  // Guaranteed cleanup: the row goes back whatever happened above.
  await prisma.product.update({
    where: { id: probe.id },
    data: { title: original.title, price: original.price },
  });
}

await go(`/dp/${probe.slug}`);
const restored = await page.locator("body").innerText();
check(
  "33. the storefront shows the original values once restored",
  restored.includes(original.title.split(",")[0]) && !restored.includes("WAVE6B PROOF"),
  restored.slice(0, 80).replace(/\s+/g, " ")
);

const apiRestored = await (await fetch(`${BASE}/api/products/${probe.id}`)).json();
check(
  "34. the API also returns the restored values",
  apiRestored?.product?.title === original.title && apiRestored?.product?.price === original.price,
  `${apiRestored?.product?.price}`
);

await prisma.$disconnect();
await browser.close();
await qa.cleanup();

console.log(`\n${total - problems.length}/${total} storefront database checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
