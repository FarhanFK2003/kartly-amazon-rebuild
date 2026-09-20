// QA for the department navigation drawer: single-instance guarantee,
// interactions, keyboard/focus handling and every link resolving.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const checks = [];
const WIDTHS = [1440, 1024, 390, 375];

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(450);
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

/** The trigger that is actually visible at this width. */
const trigger = (page) => page.locator('button[aria-haspopup="dialog"]:visible').first();
const panel = (page) => page.locator('div[role="dialog"]');

const browser = await chromium.launch();

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  attach(page, `w${w}`);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);

  /* ---- single instance ---- */
  const counts = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    triggers: document.querySelectorAll('button[aria-haspopup="dialog"]').length,
    visibleTriggers: [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      .filter((b) => b.getClientRects().length > 0).length,
  }));
  check(`w${w}: exactly one dialog in the DOM`, counts.dialogs === 1, `${counts.dialogs}`);
  check(`w${w}: exactly one visible trigger`, counts.visibleTriggers === 1, `${counts.visibleTriggers} of ${counts.triggers}`);

  /* ---- closed state is hidden from AT ---- */
  const closedState = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return { ariaHidden: d.getAttribute("aria-hidden"), x: Math.round(d.getBoundingClientRect().x) };
  });
  check(`w${w}: closed drawer is offscreen and aria-hidden`, closedState.x < 0 && closedState.ariaHidden === "true", JSON.stringify(closedState));

  /* ---- open ---- */
  await trigger(page).click();
  await page.waitForTimeout(500);
  const openState = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const r = d.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      width: Math.round(r.width),
      modal: d.getAttribute("aria-modal"),
      ariaHidden: d.getAttribute("aria-hidden"),
      label: d.getAttribute("aria-label"),
      focusInside: d.contains(document.activeElement),
      triggerExpanded: document.querySelector('button[aria-haspopup="dialog"][aria-expanded="true"]') !== null,
      bodyLocked: getComputedStyle(document.body).overflow === "hidden",
    };
  });
  check(`w${w}: drawer opens`, openState.x === 0, `x=${openState.x}`);
  check(`w${w}: drawer is modal and labelled`, openState.modal === "true" && !!openState.label, JSON.stringify({ m: openState.modal, l: openState.label }));
  check(`w${w}: open drawer is not aria-hidden`, openState.ariaHidden === null, `${openState.ariaHidden}`);
  check(`w${w}: focus moves into the drawer`, openState.focusInside);
  check(`w${w}: trigger reports expanded`, openState.triggerExpanded);
  check(`w${w}: background scroll is locked`, openState.bodyLocked);
  check(`w${w}: drawer is not oversized`, openState.width <= Math.min(w * 0.9, 400), `${openState.width}px of ${w}`);

  await page.screenshot({ path: path.join(OUT, `drawer-${w}.png`), fullPage: false });

  /* ---- Escape closes and restores focus ---- */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  const afterEsc = await page.evaluate(() => ({
    x: Math.round(document.querySelector('[role="dialog"]').getBoundingClientRect().x),
    focusOnTrigger: document.activeElement?.getAttribute("aria-haspopup") === "dialog",
  }));
  check(`w${w}: Escape closes the drawer`, afterEsc.x < 0, `x=${afterEsc.x}`);
  check(`w${w}: focus returns to the trigger`, afterEsc.focusOnTrigger);

  /* ---- outside click closes ---- */
  await trigger(page).click();
  await page.waitForTimeout(450);
  await page.mouse.click(w - 30, 500);
  await page.waitForTimeout(450);
  check(`w${w}: outside click closes the drawer`, (await page.evaluate(() => Math.round(document.querySelector('[role="dialog"]').getBoundingClientRect().x))) < 0);

  await ctx.close();
}

/* ---------------- content and interaction, desktop ---------------- */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "interaction");
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);
await trigger(page).click();
await page.waitForTimeout(500);

const content = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return {
    headings: [...d.querySelectorAll("h2")].map((h) => h.textContent.trim()),
    departmentLinks: [...d.querySelectorAll('a[href^="/s?i="]')].map((a) => a.getAttribute("href")),
    links: [...d.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    expanders: d.querySelectorAll("button[aria-expanded]").length,
  };
});
check("drawer has grouped headings", content.headings.length >= 3, content.headings.join(" | "));
check("drawer lists all 10 departments", new Set(content.departmentLinks).size === 10, `${new Set(content.departmentLinks).size}`);
check("drawer has per-department expanders", content.expanders === 10, `${content.expanders}`);

/* every link resolves and returns results */
const unique = [...new Set(content.links)];
const dead = [];
for (const href of unique) {
  const res = await page.request.get(`${BASE}${href}`);
  if (res.status() >= 400) dead.push(`${href} -> ${res.status()}`);
}
check("every drawer link resolves", dead.length === 0, `${unique.length} checked; ${dead.join(", ").slice(0, 160)}`);

/* expander reveals real brand sub-links */
const expander = page.locator('div[role="dialog"] button[aria-expanded]').first();
await expander.click();
await page.waitForTimeout(350);
const expandedInfo = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const open = d.querySelector('button[aria-expanded="true"]');
  const sub = open?.closest("li")?.querySelectorAll('ul a[href*="brand="]') ?? [];
  return { isExpanded: !!open, brandLinks: sub.length, shopAll: !!open?.closest("li")?.querySelector("ul a:not([href*='brand='])") };
});
check("expander opens a sub-list", expandedInfo.isExpanded);
check("sub-list exposes real brand links", expandedInfo.brandLinks > 0, `${expandedInfo.brandLinks}`);
check("sub-list has a shop-all link", expandedInfo.shopAll);
await page.screenshot({ path: path.join(OUT, "drawer-expanded.png"), fullPage: false });

/* keyboard: Tab stays inside the modal */
const trapped = await page.evaluate(async () => {
  const d = document.querySelector('[role="dialog"]');
  return d.contains(document.activeElement);
});
check("focus starts inside the dialog", trapped);

for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
check("Tab stays within the dialog", await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)));

await page.keyboard.down("Shift");
for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
await page.keyboard.up("Shift");
check("Shift+Tab stays within the dialog", await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)));

/* keyboard activation navigates */
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
await trigger(page).click();
await page.waitForTimeout(450);
await page.locator('div[role="dialog"] a[href^="/s?i="]').first().click();
await page.waitForURL(/\/s\?i=/, { timeout: 20000 });
await settle(page);
check("clicking a department navigates to its results", (await page.locator("article").count()) > 0, page.url());
check("drawer closes after navigating", (await page.evaluate(() => Math.round(document.querySelector('[role="dialog"]').getBoundingClientRect().x))) < 0);

/* active state reflects the current department */
await trigger(page).click();
await page.waitForTimeout(450);
const active = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const cur = d.querySelector('a[aria-current="page"]');
  return { has: !!cur, href: cur?.getAttribute("href") ?? null };
});
check("current department shows an active state", active.has && page.url().includes(active.href.split("=")[1]), JSON.stringify(active));
await ctx.close();

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nproblems (${problems.length}):`);
problems.forEach((p) => console.log(`  - ${p}`));
process.exitCode = problems.length ? 1 : 0;
