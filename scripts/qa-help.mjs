// QA for the help centre: content, search, empty state, link integrity,
// keyboard access and responsiveness.

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
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(350);
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "desktop");

/* ---- direct /help ---- */
const res = await page.goto(`${BASE}/help`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);
check("direct /help returns 200", res?.status() === 200, `${res?.status()}`);

const shape = await page.evaluate(() => {
  const topicIds = ["orders", "delivery", "returns", "payments", "account", "demo"];
  return {
    h1: document.querySelector("h1")?.textContent?.trim(),
    hasSearch: !!document.querySelector('form[action="/help"] input[name="q"]'),
    topicSections: topicIds.filter((id) => !!document.getElementById(id)),
    topicCards: document.querySelectorAll('a[href^="#"]').length,
    articles: document.querySelectorAll("details").length,
    contactCta: /Still need a hand/.test(document.body.textContent),
    headings: [...document.querySelectorAll("main h2")].map((h) => h.textContent.trim()),
  };
});
check("help heading present", /Help Centre/i.test(shape.h1 || ""), shape.h1);
check("help search present", shape.hasSearch);
check("all six topics have sections", shape.topicSections.length === 6, shape.topicSections.join(", "));
check("required topics covered", ["orders", "delivery", "returns", "payments", "account"].every((t) => shape.topicSections.includes(t)));
check("topic cards link to sections", shape.topicCards >= 6, `${shape.topicCards}`);
check("articles rendered", shape.articles >= 15, `${shape.articles}`);
check("contact CTA present", shape.contactCta);
await page.screenshot({ path: path.join(OUT, "help-desktop.png"), fullPage: false });
await page.screenshot({ path: path.join(OUT, "help-desktop-full.png"), fullPage: true });

/* ---- articles are collapsed then expandable ---- */
const first = page.locator("details").first();
check("articles start collapsed", !(await first.evaluate((d) => d.open)));
await first.locator("summary").click();
await page.waitForTimeout(250);
check("clicking an article expands it", await first.evaluate((d) => d.open));

/* ---- keyboard: summary is focusable and Enter toggles ---- */
const second = page.locator("details").nth(1);
await second.locator("summary").focus();
const focused = await page.evaluate(() => document.activeElement?.tagName);
check("article summary is keyboard focusable", focused === "SUMMARY", `${focused}`);
await page.keyboard.press("Enter");
await page.waitForTimeout(250);
check("Enter toggles the article open", await second.evaluate((d) => d.open));
await page.keyboard.press("Enter");
await page.waitForTimeout(250);
check("Enter toggles it closed again", !(await second.evaluate((d) => d.open)));

/* ---- topic anchor navigation ---- */
await page.locator('main a[href="#payments"]').first().click();
await page.waitForTimeout(500);
check("topic card jumps to its section", page.url().includes("#payments"), page.url());

/* ---- search: results ---- */
await page.goto(`${BASE}/help`, { waitUntil: "domcontentloaded" });
await settle(page);
await page.fill("#help-q", "delivery");
await page.press("#help-q", "Enter");
await page.waitForURL(/\/help\?q=delivery/, { timeout: 20000 });
await settle(page);
const found = await page.evaluate(() => ({
  results: document.querySelectorAll("details").length,
  heading: document.querySelector("main h2")?.textContent?.trim(),
  clear: !!document.querySelector('a[href="/help"]'),
}));
check("help search returns matching articles", found.results > 0, `${found.results}`);
check("result count is stated", /results? for/i.test(found.heading || ""), found.heading);
check("search offers a way back to all topics", found.clear);
await page.screenshot({ path: path.join(OUT, "help-search.png"), fullPage: false });

/* ---- search: refund term hits returns/payments content ---- */
await page.goto(`${BASE}/help?q=refund`, { waitUntil: "domcontentloaded" });
await settle(page);
check("searching 'refund' finds articles", (await page.locator("details").count()) > 0);

/* ---- search: no results ---- */
await page.goto(`${BASE}/help?q=zzzqqqnothing`, { waitUntil: "domcontentloaded" });
await settle(page);
const empty = await page.evaluate(() => ({
  text: document.querySelector("main")?.textContent || "",
  details: document.querySelectorAll("details").length,
  popular: document.querySelectorAll('a[href^="/help#"]').length,
}));
check("no-result state renders", /No help articles match/i.test(empty.text) && empty.details === 0, `${empty.details} details`);
check("no-result state offers popular topics", empty.popular >= 6, `${empty.popular}`);
check("no-result state offers a way out", /Browse all help topics/.test(empty.text));
await page.screenshot({ path: path.join(OUT, "help-empty.png"), fullPage: false });

/* ---- empty query behaves like browse ---- */
await page.goto(`${BASE}/help?q=`, { waitUntil: "domcontentloaded" });
await settle(page);
check("empty query falls back to browsing", (await page.locator("details").count()) >= 15);

/* ---- every link resolves ---- */
await page.goto(`${BASE}/help`, { waitUntil: "domcontentloaded" });
await settle(page);
const hrefs = await page.evaluate(() =>
  [...new Set([...document.querySelectorAll("main a[href]")].map((a) => a.getAttribute("href")))]
    .filter((h) => h && h.startsWith("/"))
);
const dead = [];
for (const href of hrefs) {
  const r = await page.request.get(`${BASE}${href}`);
  if (r.status() >= 400) dead.push(`${href} -> ${r.status()}`);
}
check("no dead links on the help page", dead.length === 0, `${hrefs.length} checked; ${dead.join(", ").slice(0, 160)}`);

/* ---- entry points from chrome ---- */
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page);
await page.locator('nav[aria-label="Departments and shortcuts"] a[href="/help"]').first().click();
await page.waitForURL(/\/help/, { timeout: 20000 });
await settle(page);
check("subnav Customer Service reaches help", /Help Centre/i.test((await page.locator("h1").textContent()) || ""));

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await settle(page);
await page.locator('footer a[href="/help"]').first().click();
await page.waitForURL(/\/help/, { timeout: 20000 });
await settle(page);
check("footer link reaches help", /Help Centre/i.test((await page.locator("h1").textContent()) || ""));
await ctx.close();

/* ---- responsive ---- */
const overflows = [];
for (const w of [1440, 1024, 768, 390, 375]) {
  const rctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const rpage = await rctx.newPage();
  attach(rpage, `w${w}`);
  for (const url of [`${BASE}/help`, `${BASE}/help?q=delivery`, `${BASE}/help?q=zzzqqq`]) {
    await rpage.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await settle(rpage);
    const m = await rpage.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    if (m.sw > m.cw + 1) overflows.push(`${url.split("/help")[1] || "/help"}@${w}: ${m.sw}>${m.cw}`);
  }
  if (w === 390) await rpage.screenshot({ path: path.join(OUT, "help-mobile.png"), fullPage: false });
  await rctx.close();
}
check("no horizontal overflow at any width", overflows.length === 0, overflows.join(" | "));

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nproblems (${problems.length}):`);
problems.forEach((p) => console.log(`  - ${p}`));
process.exitCode = problems.length ? 1 : 0;
