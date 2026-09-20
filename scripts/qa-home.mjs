// QA for the marketplace homepage and header autocomplete.
// Drives the production build in a real browser.

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
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 25000 })
    .catch(() => {});
  await page.waitForTimeout(400);
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "desktop");

/* ================= HOMEPAGE ================= */
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);

const structure = await page.evaluate(() => {
  const headings = [...document.querySelectorAll("main h2")].map((h) => h.textContent.trim());
  return {
    hero: !!document.querySelector('[aria-roledescription="carousel"]'),
    slides: document.querySelectorAll('[aria-roledescription="slide"]').length,
    dots: [...document.querySelectorAll("button")].filter((b) => /Go to slide/.test(b.ariaLabel || "")).length,
    headings,
    rails: [...document.querySelectorAll("section")].filter((s) => s.querySelector(".no-scrollbar")).length,
    productLinks: document.querySelectorAll('a[href^="/dp/"]').length,
    categoryLinks: document.querySelectorAll('a[href^="/s?i="]').length,
    footer: !!document.querySelector("footer"),
    images: document.images.length,
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
  };
});

check("hero carousel present", structure.hero);
check("hero has multiple slides", structure.slides >= 3, `${structure.slides}`);
check("hero has indicator dots", structure.dots === structure.slides, `${structure.dots} dots / ${structure.slides} slides`);
check("homepage has product rails", structure.rails >= 4, `${structure.rails}`);
check("homepage has category grid links", structure.categoryLinks >= 10, `${structure.categoryLinks}`);
check("homepage links to PDPs", structure.productLinks > 40, `${structure.productLinks}`);
check("footer present", structure.footer);
check("no broken images", structure.brokenImages === 0, `${structure.brokenImages}/${structure.images}`);

const wanted = ["Best Sellers", "Today's Deals", "Shop by department", "Popular in Electronics", "Recommended for you"];
for (const w of wanted) {
  check(`section "${w}" present`, structure.headings.some((h) => h.includes(w)), structure.headings.slice(0, 12).join(" | "));
}

await page.screenshot({ path: path.join(OUT, "home-desktop.png"), fullPage: false });
await page.screenshot({ path: path.join(OUT, "home-desktop-full.png"), fullPage: true });

/* ---- hero controls ---- */
const slideLabel = () => page.locator('[aria-live="polite"]').first().textContent();
const before = await slideLabel();
await page.getByRole("button", { name: "Next slide" }).click();
await page.waitForTimeout(700);
const afterNext = await slideLabel();
check("hero next control advances", before !== afterNext, `${before} -> ${afterNext}`);

await page.getByRole("button", { name: "Previous slide" }).click();
await page.waitForTimeout(700);
check("hero previous control goes back", (await slideLabel()) === before, `${await slideLabel()}`);

await page.getByRole("button", { name: "Go to slide 3" }).click();
await page.waitForTimeout(600);
check("hero dot jumps to that slide", /Slide 3 of/.test((await slideLabel()) || ""), `${await slideLabel()}`);

/* ---- autoplay: rotates on its own when not hovered ---- */
await page.mouse.move(10, 700); // away from the hero
await page.evaluate(() => window.scrollTo(0, 0));
const autoBefore = await slideLabel();
await page.waitForTimeout(7200);
const autoAfter = await slideLabel();
check("hero autoplays", autoBefore !== autoAfter, `${autoBefore} -> ${autoAfter}`);

/* ---- autoplay pauses on hover ---- */
await page.locator('[aria-roledescription="carousel"]').hover();
const pausedBefore = await slideLabel();
await page.waitForTimeout(7200);
check("hero pauses on hover", pausedBefore === (await slideLabel()), `${pausedBefore} -> ${await slideLabel()}`);
await page.mouse.move(10, 700);

/* ---- rail scrolling ---- */
const railScroll = await page.evaluate(() => {
  const track = document.querySelector("main .no-scrollbar");
  return track ? { before: track.scrollLeft, width: track.scrollWidth, client: track.clientWidth } : null;
});
check("product rail overflows and can scroll", railScroll && railScroll.width > railScroll.client, JSON.stringify(railScroll));

const nextArrow = page.getByRole("button", { name: "Scroll right" }).first();
if (await nextArrow.count()) {
  await nextArrow.click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => document.querySelector("main .no-scrollbar")?.scrollLeft ?? 0);
  check("rail arrow scrolls the track", after > 0, `scrollLeft ${after}`);
} else {
  check("rail arrow scrolls the track", false, "no scroll-right arrow rendered");
}

/* ---- every homepage link resolves ---- */
const hrefs = await page.evaluate(() =>
  [...new Set([...document.querySelectorAll("main a[href]")].map((a) => a.getAttribute("href")))]
    .filter((h) => h && h.startsWith("/"))
);
const dead = [];
for (const href of hrefs.slice(0, 60)) {
  const res = await page.request.get(`${BASE}${href}`);
  if (res.status() >= 400) dead.push(`${href} -> ${res.status()}`);
}
check("no dead homepage links", dead.length === 0, dead.join(", ").slice(0, 200));

/* ================= AUTOCOMPLETE ================= */
const input = page.locator('input[name="q"]:visible').first();
await input.click();
await input.fill("laptop");
await page.waitForTimeout(700);

const listbox = page.locator('ul[role="listbox"]').first();
check("autocomplete opens on typing", await listbox.isVisible());
const optionCount = await page.locator('li[role="option"]').count();
check("autocomplete returns suggestions", optionCount > 0 && optionCount <= 12, `${optionCount}`);

const kinds = await page.evaluate(() =>
  [...document.querySelectorAll('li[role="option"]')].map((li) => li.textContent.trim())
);
check("suggestions include a product row", kinds.some((k) => /\$\d/.test(k)), kinds.join(" | ").slice(0, 160));

const scrimVisible = await page.evaluate(() => {
  const el = [...document.body.children].find((n) => n.className && String(n.className).includes("z-40"));
  return !!el;
});
check("page scrim appears behind the dropdown", scrimVisible);
await page.screenshot({ path: path.join(OUT, "autocomplete.png"), fullPage: false });

/* ---- keyboard ---- */
await input.press("ArrowDown");
await page.waitForTimeout(200);
let activeDesc = await input.getAttribute("aria-activedescendant");
check("ArrowDown highlights the first suggestion", !!activeDesc && activeDesc.endsWith("-opt-0"), `${activeDesc}`);

await input.press("ArrowDown");
await page.waitForTimeout(200);
activeDesc = await input.getAttribute("aria-activedescendant");
check("ArrowDown moves to the second suggestion", !!activeDesc && activeDesc.endsWith("-opt-1"), `${activeDesc}`);

await input.press("ArrowUp");
await page.waitForTimeout(200);
activeDesc = await input.getAttribute("aria-activedescendant");
check("ArrowUp moves back", !!activeDesc && activeDesc.endsWith("-opt-0"), `${activeDesc}`);

await input.press("Escape");
await page.waitForTimeout(300);
check("Escape closes the dropdown", !(await listbox.isVisible().catch(() => false)));

/* ---- Enter searches ---- */
await input.click();
await input.fill("laptop");
await page.waitForTimeout(600);
await input.press("Enter");
await page.waitForURL(/\/s\?/, { timeout: 20000 });
await settle(page);
check("Enter searches for the typed term", /q=laptop/.test(page.url()), page.url());

/* ---- click a product suggestion ---- */
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page);
const input2 = page.locator('input[name="q"]:visible').first();
await input2.click();
await input2.fill("laptop");
await page.waitForTimeout(700);
const productOption = page.locator('li[role="option"]').filter({ hasText: /\$/ }).first();
const hasProductOption = (await productOption.count()) > 0;
if (hasProductOption) {
  await productOption.click();
  await page.waitForURL(/\/dp\//, { timeout: 20000 });
  await settle(page);
  check("clicking a product suggestion opens its PDP", /\/dp\/.+/.test(page.url()), page.url());
} else {
  check("clicking a product suggestion opens its PDP", false, "no product suggestion rendered");
}

/* ---- click outside closes ---- */
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page);
const input3 = page.locator('input[name="q"]:visible').first();
await input3.click();
await input3.fill("head");
await page.waitForTimeout(700);
check("dropdown open before outside click", await page.locator('ul[role="listbox"]').first().isVisible());
await page.mouse.click(720, 700);
await page.waitForTimeout(400);
check("clicking outside closes the dropdown", (await page.locator('ul[role="listbox"]').count()) === 0);

/* ---- empty and nonsense ---- */
await input3.click();
await input3.fill("");
await page.waitForTimeout(500);
check("empty query shows no dropdown", (await page.locator('ul[role="listbox"]').count()) === 0);

await input3.fill("zzzqqqxxnotathing");
await page.waitForTimeout(700);
check("nonsense query shows no dropdown", (await page.locator('ul[role="listbox"]').count()) === 0);

/* ---- suggest endpoint ---- */
const api = await page.request.get(`${BASE}/api/suggest?q=lap`);
const apiJson = await api.json();
check("suggest endpoint returns results", api.status() === 200 && apiJson.suggestions.length > 0, `${api.status()} / ${apiJson.suggestions?.length}`);
const apiEmpty = await page.request.get(`${BASE}/api/suggest?q=`);
check("suggest endpoint handles an empty query", apiEmpty.status() === 200 && (await apiEmpty.json()).suggestions.length === 0);

/* ---- recently viewed appears after visiting a PDP ---- */
await page.goto(`${BASE}/dp/meridia-stratus-14-laptop-computers-01`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page);
const hasRecent = await page.evaluate(() =>
  [...document.querySelectorAll("main h2")].some((h) => /recently viewed/i.test(h.textContent))
);
check("recently viewed appears after visiting a PDP", hasRecent);

/* ---- overflow ---- */
let ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check("desktop homepage: no horizontal overflow", ov.sw <= ov.cw + 1, JSON.stringify(ov));
await ctx.close();

/* ================= MOBILE ================= */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attach(mpage, "mobile-390");
await mpage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
ov = await mpage.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check("mobile homepage: no horizontal overflow", ov.sw <= ov.cw + 1, JSON.stringify(ov));
await mpage.screenshot({ path: path.join(OUT, "home-mobile.png"), fullPage: false });

const minput = mpage.locator('input[name="q"]:visible').first();
await minput.click();
await minput.fill("laptop");
await mpage.waitForTimeout(800);
check("mobile autocomplete opens", (await mpage.locator('ul[role="listbox"]').count()) > 0);
ov = await mpage.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check("mobile autocomplete: no horizontal overflow", ov.sw <= ov.cw + 1, JSON.stringify(ov));
await mpage.screenshot({ path: path.join(OUT, "autocomplete-mobile.png"), fullPage: false });
await mctx.close();

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nroutesNotBuiltYet: ${[...missingRoutes].sort().join(", ") || "(none)"}`);
console.log(`\nproblems (${problems.length}):`);
for (const p of problems) console.log(`  - ${p}`);
process.exitCode = problems.length > 0 ? 1 : 0;
