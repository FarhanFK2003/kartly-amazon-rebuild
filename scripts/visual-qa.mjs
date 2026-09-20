// Visual + behavioural QA for the Kartly chrome.
// Drives a real Chromium at three breakpoints, captures screenshots, records
// console errors and page errors, and exercises search, cart and the drawer.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];

const problems = [];
const results = [];
/** 404s from routes that are genuinely not built yet, tracked separately. */
const missingRoutes = new Set();

// Routes scheduled for later phases. Next prefetches every link in view, so
// these 404 today by design rather than by fault.
const NOT_BUILT_YET = /\/(cart|signin|orders|help|dp)(\/|\?|$)/;

/**
 * App Router keeps prefetch requests in flight indefinitely, so "networkidle"
 * never fires. Wait for the chrome and for images to finish decoding instead.
 */
async function settle(page) {
  await page.waitForSelector("header", { timeout: 30000 });
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete),
    null,
    { timeout: 30000 }
  ).catch(() => {});
  await page.waitForTimeout(400);
}

function attachListeners(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      const text = msg.text();
      // Dev-server artefacts, not app faults. The production run is the one
      // that proves the console is genuinely clean.
      if (
        text.includes("Download the React DevTools") ||
        text.includes("_next/hmr") ||
        text.includes("WebSocket") ||
        text.includes("Failed to load resource: the server responded with a status of 400") ||
        // Counted precisely via the response listener below, which knows the URL.
        text.includes("the server responded with a status of 404")
      ) {
        return;
      }
      problems.push(`[${label}] console.${msg.type()}: ${text.slice(0, 300)}`);
    }
  });
  page.on("pageerror", (err) => problems.push(`[${label}] pageerror: ${String(err).slice(0, 300)}`));
  page.on("response", (res) => {
    if (res.status() !== 404) return;
    const url = new URL(res.url()).pathname;
    if (NOT_BUILT_YET.test(url)) missingRoutes.add(url);
    else problems.push(`[${label}] unexpected 404: ${url}`);
  });
  page.on("requestfailed", (req) => {
    const f = req.failure();
    if (!f || req.url().includes("favicon")) return;
    // App Router cancels in-flight RSC prefetches on navigation; not a fault.
    if (req.url().includes("_rsc=") && f.errorText === "net::ERR_ABORTED") return;
    problems.push(`[${label}] requestfailed: ${req.url().slice(0, 120)} ${f.errorText}`);
  });
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  attachListeners(page, vp.name);

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);
  await page.waitForTimeout(700);

  // ---- horizontal overflow check ----
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const overflows = overflow.scrollWidth > overflow.clientWidth + 1;
  if (overflows) {
    problems.push(`[${vp.name}] horizontal overflow: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`);
  }

  // ---- measure header bands ----
  const metrics = await page.evaluate(() => {
    // Desktop and mobile chrome both exist in the DOM, one of them display:none.
    // Measuring the first match would report the hidden one, so take the first
    // element that actually has a box.
    const pick = (sel) => {
      const el = [...document.querySelectorAll(sel)].find((n) => n.getClientRects().length > 0);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    };
    return {
      header: pick("header"),
      searchForm: pick('form[role="search"]'),
      subnav: pick('nav[aria-label="Departments and shortcuts"]'),
      cartLink: pick('a[href="/cart"]'),
      wordmark: pick('svg[aria-label="Kartly"]'),
    };
  });

  await page.screenshot({ path: path.join(OUT, `${vp.name}-home-top.png`), clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 760) } });
  await page.screenshot({ path: path.join(OUT, `${vp.name}-home-full.png`), fullPage: true });

  // ---- footer / back to top ----
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${vp.name}-footer.png`), clip: { x: 0, y: Math.max(0, vp.height - 700), width: vp.width, height: Math.min(700, vp.height) } });

  const backToTop = page.getByRole("button", { name: "Back to top" });
  let backToTopWorks = false;
  if (await backToTop.count()) {
    await backToTop.first().click();
    // Smooth scrolling from the footer of a long page takes well over a second,
    // so poll rather than assuming a fixed settle time.
    for (let i = 0; i < 40 && !backToTopWorks; i++) {
      await page.waitForTimeout(150);
      backToTopWorks = (await page.evaluate(() => window.scrollY)) < 40;
    }
  }
  if (!backToTopWorks) problems.push(`[${vp.name}] back-to-top did not return to top`);

  results.push({ viewport: vp.name, metrics, overflows, backToTopWorks });
  await ctx.close();
}

// ---------------- behaviour: search, cart, drawer ----------------
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attachListeners(page, "behaviour");
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);

// search via Enter
await page.locator('input[name="q"]').first().fill("laptop");
await page.locator('input[name="q"]').first().press("Enter");
await page.waitForURL(/\/s\?/, { timeout: 30000 });
await page.waitForTimeout(900);
const searchUrl = page.url();
const searchResultCount = await page.locator("article").count();
const inputRetained = await page.locator('input[name="q"]').first().inputValue();
await page.screenshot({ path: path.join(OUT, "desktop-1440-search.png"), fullPage: false });

// search via button
let buttonSearchUrl = "(not attempted)";
try {
  await page.locator('input[name="q"]').first().fill("dog bed");
  await page.waitForTimeout(200);
  const typed = await page.locator('input[name="q"]').first().inputValue();
  await page.locator('button[aria-label="Go"]').first().click();
  await page.waitForURL(/q=dog/, { timeout: 15000 });
  buttonSearchUrl = page.url();
  void typed;
} catch {
  buttonSearchUrl = `FAILED (field held "${await page.locator('input[name="q"]').first().inputValue()}", url ${page.url()})`;
  problems.push(`[behaviour] button search did not navigate: ${buttonSearchUrl}`);
}
await page.waitForTimeout(400);

// cart count
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page);
await page.waitForTimeout(600);
const cartBefore = (await page.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "";
const addButtons = page.getByRole("button", { name: "Add to cart" });
const addCount = await addButtons.count();
await addButtons.nth(0).click();
await page.waitForTimeout(350);
await addButtons.nth(1).click();
await page.waitForTimeout(350);
await addButtons.nth(0).click();
await page.waitForTimeout(700);
const cartAfter = (await page.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "";
await page.screenshot({ path: path.join(OUT, "desktop-1440-cart-count.png"), clip: { x: 900, y: 0, width: 540, height: 120 } });

// persistence across reload
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const cartAfterReload = (await page.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "";

await ctx.close();

// mobile drawer
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attachListeners(mpage, "mobile-drawer");
await mpage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
await mpage.waitForTimeout(500);
await mpage.getByRole("button", { name: "Open all departments" }).first().click();
await mpage.waitForTimeout(600);
const drawerVisible = await mpage.locator('div[role="dialog"]').first().isVisible();
const drawerBox = await mpage.locator('div[role="dialog"]').first().boundingBox();
await mpage.screenshot({ path: path.join(OUT, "mobile-390-drawer.png") });
await mpage.keyboard.press("Escape");
await mpage.waitForTimeout(500);
const drawerClosed = (await mpage.locator('div[role="dialog"]').first().boundingBox())?.x ?? 0;
await mctx.close();

await browser.close();

console.log(JSON.stringify({
  viewports: results,
  search: { searchUrl, buttonSearchUrl, searchResultCount, inputRetained },
  cart: { addButtonsOnPage: addCount, before: cartBefore, after: cartAfter, afterReload: cartAfterReload },
  drawer: { visible: drawerVisible, width: drawerBox?.width, xAfterEscape: drawerClosed },
  routesNotBuiltYet: [...missingRoutes].sort(),
  problems,
}, null, 2));
