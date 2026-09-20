// QA for Frequently Bought Together: selection, totals, cart integration.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const checks = [];
function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(400);
}

function attach(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    if (/React DevTools|_next\/hmr|WebSocket|status of 400|status of 404|preloaded using link preload/.test(t)) return;
    problems.push(`[${label}] console.${m.type()}: ${t.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${String(e).slice(0, 200)}`));
}

const money = (t) => Number((t.match(/\$\s*([\d,]+)\s*\.?\s*(\d{2})?/) || [])[0]?.replace(/[$,\s]/g, "") || 0);
const cartCount = async (page) =>
  Number(((await page.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "").match(/(\d+)/)?.[1] ?? -1);

/** Reads the section's total by parsing its PriceBlock parts. */
const sectionTotal = (page) =>
  page.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="fbt-heading"]');
    const block = [...s.querySelectorAll("span")].find((el) => /^\$/.test(el.textContent.trim()) === false && el.querySelector?.("span"));
    const text = s.textContent.match(/Total price for \d+ items?\$?([\d,]+)(\d{2})/);
    if (text) return Number(`${text[1].replace(/,/g, "")}.${text[2]}`);
    void block;
    return null;
  });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "desktop");

await page.goto(`${BASE}/dp/meridia-stratus-14-laptop-computers-01`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);

const section = page.locator('section[aria-labelledby="fbt-heading"]');
check("FBT section renders", (await section.count()) === 1);

const info = await page.evaluate(() => {
  const s = document.querySelector('section[aria-labelledby="fbt-heading"]');
  return {
    heading: s.querySelector("h2").textContent.trim(),
    thumbs: s.querySelectorAll("a[href^='/dp/'] img").length,
    checkboxes: s.querySelectorAll('input[type="checkbox"]').length,
    checked: s.querySelectorAll('input[type="checkbox"]:checked').length,
    prices: (s.textContent.match(/\$[\d,]+\.\d{2}/g) || []).length,
    thisItem: /This item:/.test(s.textContent),
    button: [...s.querySelectorAll("button")].map((b) => b.textContent.trim())[0],
  };
});
check("heading present", /Frequently bought together/i.test(info.heading), info.heading);
check("2-4 complementary products offered", info.checkboxes >= 3 && info.checkboxes <= 5, `${info.checkboxes} items incl. anchor`);
check("all items selected by default", info.checked === info.checkboxes, `${info.checked}/${info.checkboxes}`);
check("thumbnails shown", info.thumbs === info.checkboxes, `${info.thumbs}`);
check("per-item prices shown", info.prices >= info.checkboxes, `${info.prices}`);
check("anchor marked as This item", info.thisItem);
check("add button reflects the count", /Add \d+ items? to Cart/.test(info.button || ""), info.button);

await page.screenshot({ path: path.join(OUT, "fbt-desktop.png"), fullPage: false });

/* ---- totals maths ---- */
const itemPrices = await page.evaluate(() => {
  const s = document.querySelector('section[aria-labelledby="fbt-heading"]');
  return [...s.querySelectorAll("li")].map((li) => {
    const m = li.textContent.match(/\$([\d,]+\.\d{2})/);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  }).filter((n) => n !== null);
});
const totalAll = await sectionTotal(page);
const sumAll = itemPrices.reduce((a, b) => a + b, 0);
check("combined total equals the sum of selected items", Math.abs(totalAll - sumAll) < 0.02, `${totalAll} vs ${sumAll}`);

/* ---- deselect updates total and count ---- */
const boxes = section.locator('input[type="checkbox"]');
await boxes.nth(1).uncheck();
await page.waitForTimeout(350);
const totalAfter = await sectionTotal(page);
check("deselecting lowers the total", Math.abs(totalAfter - (sumAll - itemPrices[1])) < 0.02, `${totalAfter} vs ${(sumAll - itemPrices[1]).toFixed(2)}`);
const btnAfter = (await section.locator("button").first().textContent()) || "";
check("button count follows the selection", /Add 3 items to Cart/.test(btnAfter), btnAfter.trim());

const dimmed = await page.evaluate(() => {
  const s = document.querySelector('section[aria-labelledby="fbt-heading"]');
  return [...s.querySelectorAll("a[href^='/dp/']")].filter((a) => a.className.includes("opacity-40")).length;
});
check("deselected item is visually dimmed", dimmed === 1, `${dimmed}`);

/* ---- reselect restores ---- */
await boxes.nth(1).check();
await page.waitForTimeout(350);
check("reselecting restores the total", Math.abs((await sectionTotal(page)) - sumAll) < 0.02);

/* ---- deselect all ---- */
for (let i = 0; i < 4; i++) await boxes.nth(i).uncheck();
await page.waitForTimeout(350);
const emptyBtn = section.locator("button").first();
check("empty selection disables the button", await emptyBtn.isDisabled());
check("empty selection prompts the shopper", /Select an item/.test((await emptyBtn.textContent()) || ""));

/* ---- add selected to cart ---- */
await boxes.nth(0).check();
await boxes.nth(2).check();
await page.waitForTimeout(300);
const before = await cartCount(page);
const expectTotal = await sectionTotal(page);
await section.locator("button").first().click();
await page.waitForTimeout(900);
const after = await cartCount(page);
check("adding selected updates the header cart count", after === before + 2, `${before} -> ${after}`);
check("button confirms the addition", /Added 2 to cart/.test((await section.locator("button").first().textContent()) || ""));

/* ---- cart contains exactly those items at that price ---- */
const wanted = await page.evaluate(() => {
  const s = document.querySelector('section[aria-labelledby="fbt-heading"]');
  return [...s.querySelectorAll("li")]
    .filter((li) => li.querySelector('input[type="checkbox"]').checked)
    .map((li) => li.querySelector("a[href^='/dp/']").getAttribute("href"));
});
await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
await settle(page);
const cartText = (await page.locator("main").textContent()) || "";
const cartLinks = await page.evaluate(() => [...document.querySelectorAll('main a[href^="/dp/"]')].map((a) => a.getAttribute("href")));
check("cart contains both chosen products", wanted.every((h) => cartLinks.includes(h)), `${wanted.join(", ")}`);
const cartSubtotal = money((cartText.match(/Subtotal \(\d+ items?\):\s*\$[\d,]+\.\d{2}/) || [""])[0]);
check("cart subtotal matches the bundle total", Math.abs(cartSubtotal - expectTotal) < 0.02, `${cartSubtotal} vs ${expectTotal}`);
await page.screenshot({ path: path.join(OUT, "fbt-cart.png"), fullPage: false });

/* ---- does not dominate the PDP ---- */
const share = await page.evaluate(async () => {
  const res = await fetch("/dp/meridia-stratus-14-laptop-computers-01");
  void res;
  return null;
});
void share;
await page.goto(`${BASE}/dp/meridia-stratus-14-laptop-computers-01`, { waitUntil: "domcontentloaded" });
await settle(page);
const proportion = await page.evaluate(() => {
  const s = document.querySelector('section[aria-labelledby="fbt-heading"]');
  return Math.round((s.getBoundingClientRect().height / document.documentElement.scrollHeight) * 100);
});
check("section does not dominate the page", proportion <= 15, `${proportion}% of page height`);

await ctx.close();

/* ---- mobile ---- */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attach(mpage, "mobile");
await mpage.goto(`${BASE}/dp/meridia-stratus-14-laptop-computers-01`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
const m = await mpage.evaluate(() => {
  const s = document.querySelector('section[aria-labelledby="fbt-heading"]');
  const r = s.getBoundingClientRect();
  return {
    visible: r.height > 0,
    withinViewport: r.right <= document.documentElement.clientWidth + 1,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    checkboxes: s.querySelectorAll('input[type="checkbox"]').length,
  };
});
check("mobile: section renders", m.visible && m.checkboxes >= 3, JSON.stringify(m));
check("mobile: no horizontal overflow", !m.overflow && m.withinViewport, JSON.stringify(m));
await mpage.locator('section[aria-labelledby="fbt-heading"]').scrollIntoViewIfNeeded();
await mpage.screenshot({ path: path.join(OUT, "fbt-mobile.png"), fullPage: false });

const mBefore = await cartCount(mpage);
await mpage.locator('section[aria-labelledby="fbt-heading"] button').first().click();
await mpage.waitForTimeout(800);
check("mobile: add selected works", (await cartCount(mpage)) === mBefore + 4, `${mBefore} -> ${await cartCount(mpage)}`);
await mctx.close();

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nproblems (${problems.length}):`);
problems.forEach((p) => console.log(`  - ${p}`));
process.exitCode = problems.length ? 1 : 0;
