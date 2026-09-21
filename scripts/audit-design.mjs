// Design-consistency audit.
//
// Walks every route and collects computed styles for the primitives that carry
// the visual system - buttons, cards, headings, form controls, icons, badges -
// then reports the distinct values found for each. Outliers in these lists are
// the inconsistencies worth fixing.

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["home", "/"],
  ["search", "/s?q=laptop"],
  ["pdp", "/dp/meridia-stratus-14-laptop-computers-01"],
  ["cart", "/cart"],
  ["checkout", "/checkout"],
  ["orders", "/orders"],
  ["signin", "/signin"],
  ["help", "/help"],
  ["404", "/no-such-route"],
];

const collect = () => {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const visible = (el) => el.getClientRects().length > 0;
  const out = {
    buttons: [],
    cards: [],
    headings: [],
    controls: [],
    icons: [],
    badges: [],
    links: [],
  };

  for (const el of document.querySelectorAll("button, a[class*='rounded-full']")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // Only pill/box CTAs, not bare text links or icon-only chrome buttons.
    if (px(s.borderTopLeftRadius) < 4) continue;
    out.buttons.push({
      h: Math.round(r.height),
      radius: s.borderTopLeftRadius,
      font: s.fontSize,
      weight: s.fontWeight,
      bg: s.backgroundColor,
      shadow: s.boxShadow === "none" ? "none" : "set",
      text: (el.textContent || "").trim().slice(0, 22),
    });
  }

  for (const el of document.querySelectorAll(".card")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    out.cards.push({ radius: s.borderTopLeftRadius, padding: s.padding, bg: s.backgroundColor });
  }

  for (const el of document.querySelectorAll("main h1, main h2, main h3")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    out.headings.push({ tag: el.tagName, font: s.fontSize, weight: s.fontWeight });
  }

  for (const el of document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    out.controls.push({
      tag: el.tagName,
      h: Math.round(el.getBoundingClientRect().height),
      radius: s.borderTopLeftRadius,
      font: s.fontSize,
      border: s.borderTopWidth + " " + s.borderTopColor,
    });
  }

  for (const el of document.querySelectorAll("svg")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    out.icons.push(`${Math.round(r.width)}x${Math.round(r.height)}`);
  }

  for (const el of document.querySelectorAll("[class*='rounded-'][class*='px-']")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.height > 30 || r.height < 12) continue;
    if (s.backgroundColor === "rgba(0, 0, 0, 0)") continue;
    out.badges.push({ radius: s.borderTopLeftRadius, font: s.fontSize, bg: s.backgroundColor });
  }

  for (const el of document.querySelectorAll("a.link, .link")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    out.links.push({ color: s.color, font: s.fontSize });
  }

  return out;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Seed a cart so /cart and /checkout have real content.
await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Add to cart" }).first().click();
await page.waitForTimeout(500);

const all = { buttons: [], cards: [], headings: [], controls: [], icons: [], badges: [], links: [] };
const perRoute = {};

for (const [name, route] of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(400);
  const data = await page.evaluate(collect);
  perRoute[name] = data;
  for (const key of Object.keys(all)) all[key].push(...data[key].map((d) => ({ ...d, route: name })));
}

await ctx.close();
await browser.close();

const tally = (rows, keyFn) => {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, { count: 0, routes: new Set(), samples: [] });
    const e = m.get(k);
    e.count++;
    e.routes.add(r.route);
    if (e.samples.length < 3 && r.text) e.samples.push(r.text);
  }
  return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
};

const show = (title, rows, keyFn) => {
  console.log(`\n=== ${title} (${rows.length} elements) ===`);
  for (const [k, v] of tally(rows, keyFn)) {
    const routes = [...v.routes].join(",");
    const samples = v.samples.length ? `  eg: ${v.samples.join(" | ")}` : "";
    console.log(`  ${String(v.count).padStart(4)}x  ${k}   [${routes}]${samples}`);
  }
};

show("BUTTON heights", all.buttons, (b) => `h=${b.h}`);
show("BUTTON radius", all.buttons, (b) => `r=${b.radius}`);
show("BUTTON font", all.buttons, (b) => `${b.font}/${b.weight}`);
show("BUTTON shadow", all.buttons, (b) => b.shadow);
show("CARD radius+padding", all.cards, (c) => `${c.radius} / ${c.padding}`);
show("HEADING sizes", all.headings, (h) => `${h.tag} ${h.font}/${h.weight}`);
show("FORM control heights", all.controls, (c) => `${c.tag} h=${c.h} r=${c.radius}`);
show("FORM control border", all.controls, (c) => c.border);
show("ICON sizes", all.icons.map((i) => ({ i, route: i.route })), (x) => x.i);
show("BADGE radius+font", all.badges, (b) => `${b.radius} ${b.font}`);
show("LINK colors", all.links, (l) => l.color);

fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify(perRoute, null, 2));
console.log(`\nfull data: ${OUT}/audit.json`);
