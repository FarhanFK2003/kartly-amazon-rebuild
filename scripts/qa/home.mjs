/**
 * The storefront homepage.
 *
 * Rewritten from scripts/qa-home.mjs, whose subject - a rotating hero, two
 * four-up promo grids and five boxed rails - no longer exists. The assertions
 * that survived are about behaviour: images load, departments navigate, real
 * products render, and adding to the cart works. See COVERAGE.md for the
 * old-to-new mapping.
 *
 *   node scripts/qa/home.mjs <output-dir>
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { TID, byTestId, cartCount, searchTrigger, searchOverlay, browseTrigger, bottomTabs } from "./selectors.mjs";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
let total = 0;
const check = (name, passed, detail = "") => {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
};
const settle = (page, ms = 700) => page.waitForTimeout(ms);

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

/* ---- 1-3. loads, headings, hero --------------------------------------- */
await page.goto(BASE, { waitUntil: "networkidle" });
await settle(page, 900);

check("the homepage loads", (await page.locator("main").count()) === 1);
check("exactly one H1", (await page.getByRole("heading", { level: 1 }).count()) === 1,
  `${await page.getByRole("heading", { level: 1 }).count()}`);

/* Heading order must not skip a level. */
const levels = await page.evaluate(() =>
  [...document.querySelectorAll("main h1,main h2,main h3")].map((h) => Number(h.tagName[1]))
);
const skips = levels.filter((l, i) => i > 0 && l - levels[i - 1] > 1);
check("heading hierarchy does not skip a level", skips.length === 0, levels.join(","));

check("the hero renders", await byTestId(page, TID.hero).isVisible());

/* ---- 4. hero actions --------------------------------------------------- */
const hero = byTestId(page, TID.hero);
const primary = hero.getByRole("link", { name: /Start browsing/i });
check("the hero has a primary action", await primary.isVisible());
await primary.click();
await page.waitForURL(/\/browse/, { timeout: 15000 });
check("the hero primary action reaches /browse", page.url().endsWith("/browse"), page.url());
await page.goBack();
await settle(page, 800);

const secondary = hero.getByRole("link", { name: /reduced/i });
check("the hero has a secondary action", await secondary.isVisible());
const secondaryHref = await secondary.getAttribute("href");
check("the secondary action points at a real discovery URL", secondaryHref === "/s?deals=1", String(secondaryHref));

/* Hero products are real and link to real product pages. */
const heroLinks = await hero.locator("a[href^='/dp/']").count();
check("the hero shows real products", heroLinks >= 3, `${heroLinks}`);

/* ---- 5-6. category discovery ------------------------------------------ */
const categories = byTestId(page, TID.categorySection);
check("the category section renders", await categories.isVisible());

const catHrefs = await categories.evaluate((el) =>
  [...el.querySelectorAll("a[href^='/s?i=']")].map((a) => a.getAttribute("href"))
);
check("every department is linked", new Set(catHrefs).size === 10, `${new Set(catHrefs).size} unique`);

/* Each department link must resolve to a discovery page with results. */
for (const href of [...new Set(catHrefs)].slice(0, 3)) {
  const r = await page.goto(BASE + href, { waitUntil: "domcontentloaded" });
  await settle(page, 400);
  const n = await byTestId(page, TID.productCard).count();
  check(`department link ${href} reaches a real discovery page`, r.status() === 200 && n > 0, `${r.status()}, ${n} cards`);
}
await page.goto(BASE, { waitUntil: "networkidle" });
await settle(page, 900);

/* ---- 7-8. products ----------------------------------------------------- */
const cards = byTestId(page, TID.productCard);
const cardCount = await cards.count();
check("real product cards render", cardCount > 0, `${cardCount}`);

/* Every card must carry a title, a price and a link - not a placeholder. */
const cardIntegrity = await page.evaluate(
  ({ card, title, price }) => {
    const all = [...document.querySelectorAll(`[data-testid="${card}"]`)];
    return all.map((c) => ({
      hasTitle: !!c.querySelector(`[data-testid="${title}"]`)?.textContent?.trim(),
      hasPrice: /\d/.test(c.querySelector(`[data-testid="${price}"]`)?.textContent || ""),
      href: c.querySelector(`[data-testid="${title}"]`)?.getAttribute("href") || "",
    }));
  },
  { card: TID.productCard, title: TID.productCardTitle, price: TID.productCardPrice }
);
check("every card has a title", cardIntegrity.every((c) => c.hasTitle));
check("every card has a price", cardIntegrity.every((c) => c.hasPrice));
check("every card links to a product page", cardIntegrity.every((c) => c.href.startsWith("/dp/")));

const firstHref = cardIntegrity[0].href;
const pdp = await page.goto(BASE + firstHref, { waitUntil: "domcontentloaded" });
check("a homepage product link resolves", pdp.status() === 200, String(pdp.status()));
await page.goto(BASE, { waitUntil: "networkidle" });
await settle(page, 900);

/* images must all load - this check survives from the old suite verbatim */
const broken = await page.evaluate(() =>
  [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length
);
check("no broken images", broken === 0, `${broken} broken of ${await page.locator("img").count()}`);

/* ---- 9. add to cart ---------------------------------------------------- */
const before = (await cartCount(page)) ?? 0;
await byTestId(page, TID.addToCart).first().click();
await settle(page, 800);
check("add to cart works from a homepage card", (await cartCount(page)) === before + 1,
  `${before} -> ${await cartCount(page)}`);
await page.keyboard.press("Escape");
await settle(page, 400);

/* ---- 10-11. chrome still works from here ------------------------------- */
await searchTrigger(page).click();
await settle(page, 400);
check("search opens from the homepage", await searchOverlay(page).isVisible());
await page.keyboard.press("Escape");
await settle(page, 300);

await browseTrigger(page).click();
await settle(page, 350);
check("browse opens from the homepage", await byTestId(page, TID.browsePopover).isVisible());
await page.keyboard.press("Escape");
await settle(page, 300);

/* ---- section purpose: each one carries real catalogue content ---------- */
const shelves = await byTestId(page, TID.shelf).count();
check("the page has product shelves", shelves >= 2, `${shelves}`);
check("the reduced section renders", await byTestId(page, TID.reducedSection).isVisible());

/* Discounts shown must be real: a discounted card must carry a struck price. */
const discountsHonest = await page.evaluate((priceTid) =>
  [...document.querySelectorAll(`[data-testid="${priceTid}"]`)].every((el) => {
    const struck = el.querySelector(".line-through");
    return !struck || /\d/.test(struck.textContent || "");
  }), TID.productCardPrice);
check("discount treatments are backed by a real list price", discountsHonest);

await page.screenshot({ path: path.join(OUT, "home-1440.png"), fullPage: false });
await ctx.close();

/* ---- 12, 17-18. responsive + mobile chrome ----------------------------- */
for (const width of [375, 390, 430, 768, 1024, 1280, 1440]) {
  const mctx = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: width <= 480,
    hasTouch: width <= 480,
  });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(`[${width}] ${String(e).slice(0, 140)}`));
  const w = `@${width}`;

  await mp.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(mp, 800);

  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  check(`${w} no horizontal overflow`, sw <= width + 1, `${sw}`);
  check(`${w} the hero renders`, await byTestId(mp, TID.hero).isVisible());
  check(`${w} product cards render`, (await byTestId(mp, TID.productCard).count()) > 0);

  if (width <= 1023) {
    check(`${w} bottom tabs remain functional`, await bottomTabs(mp).isVisible());
    /* the fixed tab bar must not sit over the end of the page */
    const covered = await mp.evaluate(() => {
      const nav = document.querySelector('[data-testid="bottom-tabs"]');
      const footer = document.querySelector("footer");
      if (!nav || !footer) return false;
      window.scrollTo(0, document.body.scrollHeight);
      return footer.getBoundingClientRect().bottom > nav.getBoundingClientRect().top + 1;
    });
    check(`${w} bottom tabs do not cover content`, !covered);
  } else {
    check(`${w} bottom tabs are hidden on desktop`, !(await bottomTabs(mp).isVisible()));
  }

  if (width === 390) await mp.screenshot({ path: path.join(OUT, "home-390.png") });
  await mctx.close();
}

await browser.close();

check("no unexpected 404 responses", badResponses.length === 0, badResponses.slice(0, 3).join(" | "));
check("no console, page or hydration errors", errors.length === 0, errors.slice(0, 3).join(" | "));

console.log(`\n${total - problems.length}/${total} homepage checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
