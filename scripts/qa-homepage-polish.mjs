// Homepage refinement QA: geometry at six widths plus every interactive
// element on the page. Runs against the production build.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const checks = [];
const WIDTHS = [1440, 1280, 1024, 768, 390, 375];

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(500);
}

function attach(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    if (/React DevTools|_next\/hmr|WebSocket|status of 400|status of 404|preloaded using link preload/.test(t)) return;
    problems.push(`[${label}] console.${m.type()}: ${t.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${String(e).slice(0, 200)}`));
  page.on("requestfailed", (r) => {
    const f = r.failure();
    if (!f || r.url().includes("favicon")) return;
    if (r.url().includes("_rsc=") && f.errorText === "net::ERR_ABORTED") return;
    problems.push(`[${label}] requestfailed ${r.url().slice(0, 90)}`);
  });
}

const browser = await chromium.launch();

/* ---------------- geometry across widths ---------------- */
const geo = [];
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 } });
  const page = await ctx.newPage();
  attach(page, `w${w}`);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);

  const m = await page.evaluate(() => {
    const hero = document.querySelector('[aria-roledescription="carousel"]').getBoundingClientRect();
    // The track is translated, so measure the slide actually inside the hero box.
    const slide = [...document.querySelectorAll('[aria-roledescription="slide"]')].find((s) => {
      const r = s.getBoundingClientRect();
      return r.left >= hero.left - 4 && r.left <= hero.left + 4;
    });
    const cta = slide.querySelector("a").getBoundingClientRect();
    const h2 = slide.querySelector("h2").getBoundingClientRect();
    const dot = document.querySelector('button[aria-label^="Go to slide"]').getBoundingClientRect();
    const aL = document.querySelector('button[aria-label="Previous slide"]').getBoundingClientRect();
    const sections = [...document.querySelectorAll("main .shell > *")];
    const gaps = [];
    for (let i = 1; i < sections.length; i++) {
      gaps.push(Math.round(sections[i].getBoundingClientRect().top - sections[i - 1].getBoundingClientRect().bottom));
    }
    const rail = document.querySelector("main section .no-scrollbar");
    return {
      heroH: Math.round(hero.height),
      headlinePx: parseFloat(getComputedStyle(slide.querySelector("h2")).fontSize),
      dotClear: Math.round(dot.top - cta.bottom),
      arrowClear: Math.min(Math.round(cta.left - aL.right), Math.round(h2.left - aL.right)),
      gaps: [...new Set(gaps)],
      railCardW: rail?.firstElementChild ? Math.round(rail.firstElementChild.getBoundingClientRect().width) : null,
      railScrollable: rail ? rail.scrollWidth > rail.clientWidth : null,
      docH: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
      tallestImage: Math.max(...[...document.images].map((i) => Math.round(i.getBoundingClientRect().height))),
    };
  });
  geo.push({ w, ...m });

  check(`w${w}: no horizontal overflow`, !m.overflow);
  check(`w${w}: no broken images`, m.broken === 0, `${m.broken}`);
  check(`w${w}: hero CTA clears the indicator dots`, m.dotClear >= 8, `${m.dotClear}px`);
  check(`w${w}: hero text clears the side arrows`, m.arrowClear >= 0, `${m.arrowClear}px`);
  check(`w${w}: section gaps are uniform`, m.gaps.length === 1 && m.gaps[0] === 16, JSON.stringify(m.gaps));
  check(`w${w}: no oversized image`, m.tallestImage <= 320, `tallest ${m.tallestImage}px`);

  await page.screenshot({ path: path.join(OUT, `hp-${w}.png`), fullPage: false });
  if (w === 1440 || w === 390) await page.screenshot({ path: path.join(OUT, `hp-${w}-full.png`), fullPage: true });
  await ctx.close();
}

// Hero must stay a band, not a stage.
check("hero stays under 260px at desktop", geo[0].heroH <= 260, `${geo[0].heroH}px`);
check("hero headline stays under 34px", geo[0].headlinePx <= 34, `${geo[0].headlinePx}px`);
check("hero scales down on mobile", geo[4].heroH < geo[0].heroH, `${geo[0].heroH} -> ${geo[4].heroH}`);

/* ---------------- interaction ---------------- */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "interaction");
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);

const label = () => page.locator('[aria-live="polite"]').first().textContent();
const before = await label();
await page.getByRole("button", { name: "Next slide" }).click();
await page.waitForTimeout(700);
check("hero next works", before !== (await label()));
await page.getByRole("button", { name: "Previous slide" }).click();
await page.waitForTimeout(700);
check("hero previous works", before === (await label()));
await page.getByRole("button", { name: "Go to slide 4" }).click();
await page.waitForTimeout(600);
check("hero dot works", /Slide 4 of/.test((await label()) || ""));

await page.mouse.move(10, 800);
const autoA = await label();
await page.waitForTimeout(7200);
check("hero autoplay works", autoA !== (await label()));
await page.locator('[aria-roledescription="carousel"]').hover();
const pauseA = await label();
await page.waitForTimeout(7200);
check("hero pauses on hover", pauseA === (await label()));
await page.mouse.move(10, 800);

// carousels
const railsBefore = await page.evaluate(() =>
  [...document.querySelectorAll("main section .no-scrollbar")].map((r) => r.scrollLeft)
);
const arrows = page.getByRole("button", { name: "Scroll right" });
const arrowCount = await arrows.count();
check("product rails expose scroll controls", arrowCount >= 3, `${arrowCount}`);
await arrows.first().click();
await page.waitForTimeout(900);
const railsAfter = await page.evaluate(() =>
  [...document.querySelectorAll("main section .no-scrollbar")].map((r) => r.scrollLeft)
);
check("rail arrow scrolls the track", railsAfter.some((v, i) => v > railsBefore[i]), `${railsBefore[0]} -> ${railsAfter[0]}`);

// every homepage link resolves
const hrefs = await page.evaluate(() =>
  [...new Set([...document.querySelectorAll("main a[href]")].map((a) => a.getAttribute("href")))].filter((h) => h && h.startsWith("/"))
);
const dead = [];
for (const href of hrefs) {
  const res = await page.request.get(`${BASE}${href}`);
  if (res.status() >= 400) dead.push(`${href} -> ${res.status()}`);
}
check("no dead homepage links", dead.length === 0, `${hrefs.length} checked; ${dead.join(", ").slice(0, 160)}`);

// department navigation
await page.locator('main a[href^="/s?i="]').first().click();
await page.waitForURL(/\/s\?i=/, { timeout: 20000 });
await settle(page);
check("department tile navigates to its results", (await page.locator("article").count()) > 0, page.url());

// a product card reaches its PDP
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page);
await page.locator('main a[href^="/dp/"]').first().click();
await page.waitForURL(/\/dp\//, { timeout: 20000 });
await settle(page);
check("product card opens its PDP", (await page.locator("h1").count()) > 0, page.url());
await ctx.close();

/* ---------------- mobile interaction ---------------- */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attach(mpage, "mobile");
await mpage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
const mLabel = () => mpage.locator('[aria-live="polite"]').first().textContent();
const mBefore = await mLabel();
await mpage.getByRole("button", { name: "Go to slide 2" }).click();
await mpage.waitForTimeout(600);
check("mobile hero dots work", mBefore !== (await mLabel()));
const railScrollable = await mpage.evaluate(() => {
  const r = document.querySelector("main section .no-scrollbar");
  return r ? r.scrollWidth > r.clientWidth : false;
});
check("mobile rails scroll horizontally", railScrollable);
await mpage.screenshot({ path: path.join(OUT, "hp-390-final.png"), fullPage: false });
await mctx.close();

await browser.close();

console.log("\n--- geometry ---");
for (const g of geo) {
  console.log(`w=${String(g.w).padEnd(5)} hero=${String(g.heroH).padEnd(4)} headline=${String(g.headlinePx).padEnd(5)} dotClear=${String(g.dotClear).padEnd(4)} arrowClear=${String(g.arrowClear).padEnd(4)} railCard=${String(g.railCardW).padEnd(4)} gaps=${JSON.stringify(g.gaps).padEnd(6)} docH=${g.docH}`);
}

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nproblems (${problems.length}):`);
problems.forEach((p) => console.log(`  - ${p}`));
process.exitCode = problems.length ? 1 : 0;
