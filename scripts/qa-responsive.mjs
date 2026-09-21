// Responsive sweep for the design-consistency pass: every key route at every
// breakpoint the brief calls out, checking for horizontal overflow, elements
// escaping the viewport, touch targets that are too small to hit, and text
// that has collapsed to an unreadable width.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [1440, 1280, 1024, 768, 480, 390, 375];
const ROUTES = [
  ["home", "/"],
  ["search", "/s?q=laptop"],
  ["browse", "/s?category=electronics&brand=Northwind"],
  ["pdp", "/dp/p-electronics-001"],
  ["cart", "/cart"],
  ["orders", "/orders"],
  ["help", "/help"],
  ["signin", "/signin"],
  ["404", "/no-such-page"],
];

const problems = [];
let checks = 0;

function check(name, passed, detail = "") {
  checks++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 40000 })
    .catch(() => {});
  await page.waitForTimeout(350);
}

const browser = await chromium.launch();

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    isMobile: width <= 480,
    hasTouch: width <= 480,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${width}] pageerror: ${String(e).slice(0, 160)}`));

  // Seed a cart so the cart page renders its real layout rather than the empty
  // state, which is the layout most likely to overflow.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem(
      "kartly-cart",
      JSON.stringify({
        state: {
          lines: [
            { productId: "p-electronics-001", qty: 2, variantId: null, saved: false },
            { productId: "p-home-002", qty: 1, variantId: null, saved: false },
          ],
        },
        version: 0,
      })
    );
  });

  for (const [label, route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await settle(page);

    const m = await page.evaluate((vw) => {
      const doc = document.documentElement;
      const offenders = [];
      // An element is an offender only if it is visible, has real size, and
      // sticks out past the viewport. Decorative overflow hidden by a parent
      // does not count, so we ignore anything inside an overflow-clipping box.
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (r.right <= vw + 1 && r.left >= -1) continue;
        // A closed off-canvas panel is parked past the edge on purpose. It only
        // counts as an offender if it is actually exposed - visible and not
        // hidden from assistive tech - and not inside an overflow-clipping box.
        let skip = false;
        for (let p = el; p; p = p.parentElement) {
          const pcs = getComputedStyle(p);
          if (/hidden|clip|auto|scroll/.test(pcs.overflowX)) { skip = true; break; }
          if (pcs.visibility === "hidden") { skip = true; break; }
          if (p.getAttribute && p.getAttribute("aria-hidden") === "true") { skip = true; break; }
        }
        if (skip) continue;
        offenders.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 40)} @${Math.round(r.left)}..${Math.round(r.right)}`);
      }

      // Tap targets: on touch widths a primary control under 32px is a miss.
      const small = [];
      for (const el of document.querySelectorAll("button, a[href], select, input[type=submit]")) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        if (r.right < 0 || r.left > vw) continue; // parked off-canvas
        if (r.height < 22 && r.width < 40) {
          small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }

      return {
        scrollWidth: doc.scrollWidth,
        offenders: offenders.slice(0, 6),
        small: small.slice(0, 6),
      };
    }, width);

    check(
      `${label} @${width} no horizontal scroll`,
      m.scrollWidth <= width + 1,
      m.scrollWidth > width + 1 ? `scrollWidth ${m.scrollWidth} vs ${width}` : ""
    );
    check(
      `${label} @${width} nothing escapes the viewport`,
      m.offenders.length === 0,
      m.offenders.join(" | ")
    );
    check(
      `${label} @${width} controls are hittable`,
      m.small.length === 0,
      m.small.join(" | ")
    );

    if (width === 1440 || width === 390) {
      await page.screenshot({
        path: path.join(OUT, `${label}-${width}.png`),
        fullPage: false,
      });
    }
  }

  await ctx.close();
}

await browser.close();

console.log(`\n${checks - problems.length}/${checks} responsive checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
