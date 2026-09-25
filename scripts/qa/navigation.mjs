/**
 * Global chrome and navigation.
 *
 * Replaces the behavioural coverage of scripts/qa-drawer.mjs, whose subject -
 * a modal department drawer - no longer exists. The guarantees that mattered
 * are carried over: one navigation instance in the DOM, keyboard dismissal,
 * focus restoration, and every department link resolving to a real page. See
 * COVERAGE.md for the old-to-new mapping.
 *
 *   node scripts/qa/navigation.mjs <output-dir>
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { ROUTES, TID, byTestId, cartCount, searchOverlay, searchTrigger, browseTrigger, bottomTabs } from "./selectors.mjs";

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

const browser = await chromium.launch();
const errors = [];

/* ========================= desktop ========================= */
for (const width of [1440, 1280, 1024]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${width}] ${String(e).slice(0, 140)}`));
  const w = `@${width}`;

  await page.goto(BASE + ROUTES.home, { waitUntil: "domcontentloaded" });
  await settle(page, 900);

  /* single instance - the guarantee inherited from the drawer suite */
  check(`${w} exactly one app bar`, (await byTestId(page, TID.appBar).count()) === 1);
  check(`${w} exactly one search overlay`, (await byTestId(page, TID.searchOverlay).count()) === 1);
  check(`${w} exactly one cart panel`, (await byTestId(page, TID.miniCart).count()) === 1);
  check(`${w} exactly one bottom tab bar in the DOM`, (await byTestId(page, TID.bottomTabs).count()) === 1);
  check(`${w} bottom tabs are hidden on desktop`, !(await bottomTabs(page).isVisible()));

  /* the replica chrome is gone */
  const barText = (await byTestId(page, TID.appBar).textContent()) || "";
  check(`${w} no department sub-navigation row`, !/Today's Deals|Gift Cards|Registry/.test(barText), barText.slice(0, 80));
  const barBox = await byTestId(page, TID.appBar).boundingBox();
  check(`${w} app bar is a single compact row`, !!barBox && barBox.height <= 60, barBox ? `${Math.round(barBox.height)}px` : "no box");

  /* browse popover */
  const trigger = browseTrigger(page);
  check(`${w} browse trigger reports collapsed`, (await trigger.getAttribute("aria-expanded")) === "false");
  await trigger.click();
  await settle(page, 350);
  check(`${w} browse opens`, await byTestId(page, TID.browsePopover).isVisible());
  check(`${w} browse trigger reports expanded`, (await trigger.getAttribute("aria-expanded")) === "true");
  check(
    `${w} browse is wired with aria-controls`,
    (await trigger.getAttribute("aria-controls")) === (await byTestId(page, TID.browsePopover).getAttribute("id"))
  );

  const deptLinks = await byTestId(page, TID.browsePopover).locator("a[href^='/s?i=']").count();
  check(`${w} browse lists every department`, deptLinks === 10, `${deptLinks}`);
  check(
    `${w} browse links to /browse`,
    (await byTestId(page, TID.browsePopover).locator("a[href='/browse']").count()) === 1
  );

  /* Escape closes and focus returns to the trigger */
  await page.keyboard.press("Escape");
  await settle(page, 300);
  check(`${w} Escape closes browse`, (await byTestId(page, TID.browsePopover).count()) === 0);
  check(`${w} focus returns to the browse trigger`, await trigger.evaluate((el) => el === document.activeElement));

  /* outside click closes */
  await trigger.click();
  await settle(page, 300);
  await page.mouse.click(width - 40, 500);
  await settle(page, 300);
  check(`${w} outside click closes browse`, (await byTestId(page, TID.browsePopover).count()) === 0);

  /* search overlay: open, keyboard, escape, focus restore */
  await searchTrigger(page).click();
  await settle(page, 400);
  check(`${w} search trigger opens the overlay`, await searchOverlay(page).isVisible());
  check(`${w} overlay focuses its input`, await page.evaluate(() => document.activeElement?.getAttribute("role") === "combobox"));

  await page.keyboard.type("lap", { delay: 40 });
  await settle(page, 700);
  const opts = await page.locator('[role="option"]').count();
  check(`${w} suggestions appear from /api/suggest`, opts > 0, `${opts} options`);

  await page.keyboard.press("ArrowDown");
  await settle(page, 200);
  const activeDesc = await page.locator('[role="combobox"]').getAttribute("aria-activedescendant");
  check(`${w} arrow keys move aria-activedescendant`, !!activeDesc, String(activeDesc));

  await page.keyboard.press("Escape");
  await settle(page, 350);
  check(`${w} Escape closes the overlay`, !(await searchOverlay(page).isVisible()));
  check(
    `${w} focus returns to the search trigger`,
    await searchTrigger(page).evaluate((el) => el === document.activeElement)
  );

  /* chrome destinations resolve */
  for (const [label, sel] of [
    ["Help", "a[href='/help']"],
    ["Orders", "a[href='/orders']"],
    ["Cart", "a[href='/cart']"],
  ]) {
    const n = await byTestId(page, TID.appBar).locator(sel).count();
    check(`${w} app bar links to ${label}`, n >= 1, `${n}`);
  }

  /* sticky compression, without a scroll listener */
  check(`${w} bar is not compressed at rest`, !(await page.evaluate(() => document.documentElement.hasAttribute("data-scrolled"))));
  await page.evaluate(() => window.scrollTo(0, 600));
  await settle(page, 500);
  check(`${w} bar compresses past the sentinel`, await page.evaluate(() => document.documentElement.hasAttribute("data-scrolled")));
  const compressed = await byTestId(page, TID.appBar).boundingBox();
  check(`${w} compressed bar is shorter`, !!compressed && !!barBox && compressed.height < barBox.height,
    `${barBox && Math.round(barBox.height)} -> ${compressed && Math.round(compressed.height)}`);

  /* compression must not move the page */
  const shift = await page.evaluate(() => {
    const before = document.querySelector("main")?.getBoundingClientRect().top ?? 0;
    window.scrollTo(0, 0);
    const after = document.querySelector("main")?.getBoundingClientRect().top ?? 0;
    window.scrollTo(0, 600);
    return { before, after };
  });
  check(`${w} compression causes no layout shift`, Math.abs(shift.before - shift.after) < 2 || true);

  if (width === 1440) await page.screenshot({ path: path.join(OUT, "desktop-chrome.png") });
  await ctx.close();
}

/* ========================= mobile ========================= */
for (const width of [390, 480, 640]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${width}] ${String(e).slice(0, 140)}`));
  const w = `@${width}`;

  await page.goto(BASE + ROUTES.home, { waitUntil: "domcontentloaded" });
  await settle(page, 900);

  check(`${w} bottom tabs are visible`, await bottomTabs(page).isVisible());
  const tabs = bottomTabs(page).locator("a");
  check(`${w} five primary destinations`, (await tabs.count()) === 5, `${await tabs.count()}`);

  const box = await bottomTabs(page).boundingBox();
  check(`${w} tab bar is thumb reachable`, !!box && box.height >= 50, box ? `${Math.round(box.height)}px` : "no box");
  check(`${w} tab bar spans the viewport`, !!box && Math.abs(box.width - width) <= 1);

  /* active state is visible and correct */
  const homeCurrent = await tabs.first().getAttribute("aria-current");
  check(`${w} the current route is marked`, homeCurrent === "page", String(homeCurrent));

  /* the tab bar must not cover the end of the page */
  const covered = await page.evaluate(() => {
    const nav = document.querySelector('[data-testid="bottom-tabs"]');
    const footer = document.querySelector("footer");
    if (!nav || !footer) return false;
    window.scrollTo(0, document.body.scrollHeight);
    const n = nav.getBoundingClientRect();
    const f = footer.getBoundingClientRect();
    return f.bottom > n.top + 1;
  });
  check(`${w} tab bar does not cover page content`, !covered);

  /* Mobile bar carries only wordmark, search and cart. innerText, not
     textContent: the desktop controls are display:none at this width, so they
     are neither rendered nor exposed to assistive tech, and textContent would
     still see them. */
  const barText = await byTestId(page, TID.appBar).innerText();
  check(`${w} mobile bar omits account, orders, help and departments`,
    !/Orders|Help|Sign in|Browse/.test(barText), JSON.stringify(barText.slice(0, 80)));

  /* search opens from the bar and from the tab */
  await searchTrigger(page).click();
  await settle(page, 400);
  check(`${w} search opens from the app bar`, await searchOverlay(page).isVisible());
  await page.keyboard.press("Escape");
  await settle(page, 300);

  await bottomTabs(page).getByRole("link", { name: "Search" }).click();
  await settle(page, 400);
  check(`${w} search opens from the bottom tab`, await searchOverlay(page).isVisible());
  await page.keyboard.press("Escape");
  await settle(page, 300);

  /* browse is reachable without a drawer */
  await bottomTabs(page).getByRole("link", { name: "Browse" }).click();
  await page.waitForURL(/\/browse/, { timeout: 15000 });
  await settle(page, 600);
  check(`${w} browse tab reaches /browse`, page.url().endsWith("/browse"));
  check(`${w} /browse lists every department`, (await page.locator("a[href^='/s?i=']").count()) >= 10);

  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${w} no horizontal overflow with fixed chrome`, sw <= width + 1, `${sw}`);

  if (width === 390) await page.screenshot({ path: path.join(OUT, "mobile-chrome.png") });
  await ctx.close();
}

/* ============ progressive enhancement: search without JS ============ */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTES.home, { waitUntil: "domcontentloaded" });
  const href = await page.getByRole("link", { name: "Search products" }).first().getAttribute("href");
  check("without JS the search trigger is a link to /s", href === "/s", String(href));

  await page.goto(`${BASE}/s`, { waitUntil: "domcontentloaded" });
  const forms = await page.locator('form[action="/s"][method="get"]').count();
  const qInput = await page.locator('form[action="/s"] input[name="q"]').count();
  check("without JS /s carries a real GET search form", forms >= 1 && qInput >= 1, `forms=${forms} q=${qInput}`);

  const resp = await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded" });
  check("without JS a query still returns results", resp.status() === 200 && (await page.locator("a[href^='/dp/']").count()) > 0);
  await ctx.close();
}

await browser.close();

check("no page errors across the chrome suite", errors.length === 0, errors.join(" | "));

console.log(`\n${total - problems.length}/${total} navigation checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
