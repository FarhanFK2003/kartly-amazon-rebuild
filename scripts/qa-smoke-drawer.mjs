// Lightweight smoke check for the mini-cart interaction, at desktop and phone.
// Deliberately narrow: the add -> drawer -> quantity -> subtotal -> persist
// sequence, the cart badge, and console health. Not a regression suite.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const checks = [];

function check(name, passed, detail = "") {
  checks.push({ name, passed });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

const money = (s) => Number(String(s).replace(/[^0-9.]/g, ""));

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
}

const browser = await chromium.launch();

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: width <= 480,
    hasTouch: width <= 480,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/DevTools|preloaded using link preload|status of 40[04]/.test(t)) return;
    consoleErrors.push(t.slice(0, 160));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 160)}`));

  const w = `@${width}`;
  const drawer = page.locator('div[role="dialog"][aria-label="Shopping cart"]');
  const badge = page.locator("a[aria-label^='Cart,']").first();

  /* A: add the first product, from a product page - the deliberate add */
  await page.goto(`${BASE}/dp/nordvik-field-4k-action-camera-electronics-03`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
  await page.waitForTimeout(600);

  check(`${w} A drawer opens on add`, await drawer.isVisible());
  check(`${w} A drawer shows the added item`, (await drawer.locator("li").count()) === 1,
    `${await drawer.locator("li").count()} rows`);
  check(`${w} A just-added marker shown`, await drawer.getByText("Added", { exact: true }).isVisible());
  check(`${w} A badge reads 1`, /Cart, 1 item/.test((await badge.getAttribute("aria-label")) || ""),
    (await badge.getAttribute("aria-label")) || "");

  const sub1 = money(await drawer.getByText(/^\$[\d,]+\.\d\d$/).last().textContent());
  check(`${w} A subtotal is positive`, sub1 > 0, String(sub1));

  await page.screenshot({ path: path.join(OUT, `drawer-open-${width}.png`) });

  /* drawer must fit the viewport */
  const box = await drawer.boundingBox();
  check(`${w} drawer fits viewport`, !!box && box.width <= width && box.x >= -1,
    box ? `w=${Math.round(box.width)} x=${Math.round(box.x)}` : "no box");
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`${w} no horizontal overflow`, scrollW <= width + 1, `${scrollW} vs ${width}`);

  /* C: increase quantity from inside the drawer */
  await drawer.getByRole("button", { name: "Increase quantity" }).first().click();
  await page.waitForTimeout(400);
  const sub2 = money(await drawer.getByText(/^\$[\d,]+\.\d\d$/).last().textContent());
  check(`${w} C subtotal grows with quantity`, sub2 > sub1, `${sub1} -> ${sub2}`);
  check(`${w} C badge reads 2`, /Cart, 2 items/.test((await badge.getAttribute("aria-label")) || ""),
    (await badge.getAttribute("aria-label")) || "");

  /* D: decrease again */
  await drawer.getByRole("button", { name: "Decrease quantity" }).first().click();
  await page.waitForTimeout(400);
  const sub3 = money(await drawer.getByText(/^\$[\d,]+\.\d\d$/).last().textContent());
  check(`${w} D subtotal returns on decrease`, sub3 === sub1, `${sub3} vs ${sub1}`);

  /* close predictably */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(`${w} Escape closes the drawer`, !(await drawer.isVisible()));

  /* B: add a second, different product */
  await page.goto(`${BASE}/dp/aureon-damascus-8-chef-knife-home-kitchen-05`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
  await page.waitForTimeout(600);
  check(`${w} B drawer shows two lines`, (await drawer.locator("li").count()) === 2,
    `${await drawer.locator("li").count()} rows`);

  /* E: remove an item - the stepper turns into a delete at qty 1 */
  await drawer.getByRole("button", { name: "Remove item" }).first().click();
  await page.waitForTimeout(400);
  check(`${w} E removing leaves one line`, (await drawer.locator("li").count()) === 1,
    `${await drawer.locator("li").count()} rows`);

  /* F: go to cart, and the drawer must not follow */
  await drawer.getByRole("link", { name: "Go to Cart" }).click();
  await page.waitForURL("**/cart");
  await settle(page);
  check(`${w} F Go to Cart navigates`, page.url().endsWith("/cart"));
  check(`${w} F drawer closed after navigating`, !(await drawer.isVisible()));

  /* G: back to shopping, add again */
  await page.goto(`${BASE}/dp/nordvik-field-4k-action-camera-electronics-03`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
  await page.waitForTimeout(600);
  check(`${w} G drawer reopens on a later add`, await drawer.isVisible());

  /* H: persistence across reload */
  const before = await badge.getAttribute("aria-label");
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  const after = await badge.getAttribute("aria-label");
  check(`${w} H cart persists across reload`, before === after, `${before} -> ${after}`);
  check(`${w} H drawer closed after reload`, !(await drawer.isVisible()));

  /* a quick add from a listing confirms in place and leaves the page usable,
     so several items can be added without dismissing anything */
  await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const beforeQuick = Number(
    (/Cart, (\d+)/.exec((await badge.getAttribute("aria-label")) || "") || [0, "0"])[1]
  );
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.waitForTimeout(400);
  check(`${w} quick add does not open the drawer`, !(await drawer.isVisible()));
  // The control becomes a quantity stepper reading "N in cart" - a confirmation
  // that stays put rather than a flash that times out.
  const inCartLabels = await page.evaluate(() =>
    [...document.querySelectorAll("span")].filter((e) => /\d+ in cart/.test(e.textContent || "")).length
  );
  check(`${w} quick add turns the control into an in-cart stepper`, inCartLabels >= 1,
    `${inCartLabels} labels`);

  // the real point: a second add still works with nothing to dismiss first
  await page.getByRole("button", { name: "Add to cart" }).nth(1).click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const afterQuick = Number(
    (/Cart, (\d+)/.exec((await badge.getAttribute("aria-label")) || "") || [0, "0"])[1]
  );
  check(`${w} consecutive quick adds both land`, afterQuick === beforeQuick + 2,
    `${beforeQuick} -> ${afterQuick}`);

  check(`${w} no console errors`, consoleErrors.length === 0, consoleErrors.join(" | "));
  await ctx.close();
}

/* header: the locale control actually opens something now */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const trigger = page.locator('[data-testid="locale-menu"] button');
  check("locale control is a real menu", (await trigger.getAttribute("aria-haspopup")) === "menu");
  await trigger.click();
  await page.waitForTimeout(300);
  const menu = page.getByRole("menu", { name: "Language and currency" });
  check("locale menu opens", await menu.isVisible());
  check("locale menu names the currency", (await menu.textContent())?.includes("USD") ?? false);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  check("locale menu closes on Escape", !(await menu.isVisible()));

  // homepage hierarchy: departments should precede the merchandising rows
  const order = await page.evaluate(() => {
    const text = [...document.querySelectorAll("h2")].map((h) => h.textContent.trim());
    return { dept: text.indexOf("Shop by department"), deals: text.indexOf("Today's Deals") };
  });
  check("departments sit above the deals rail", order.dept >= 0 && order.dept < order.deals,
    JSON.stringify(order));

  await page.screenshot({ path: path.join(OUT, "home-1440.png") });
  await ctx.close();
}

await browser.close();

console.log(`\n${checks.length - problems.length}/${checks.length} smoke checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
