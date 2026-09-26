/**
 * Layout containment sweep: every route at every supported width.
 *
 * Ported from scripts/qa-responsive.mjs. It was already almost selector-free -
 * it reasons about geometry rather than appearance - which is why it survives a
 * redesign nearly intact and is worth having early. Routes now come from the
 * shared contract so a route rename is a one-line change.
 *
 * Checks, per route per width:
 *   1. the page does not scroll horizontally
 *   2. nothing visible escapes the viewport
 *   3. every interactive control meets the minimum tap target
 *   4. no page errors
 *
 *   node scripts/qa/responsive.mjs <output-dir>
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { ROUTES, WIDTHS } from "./selectors.mjs";
import { startQaSession } from "./qa-session.mjs";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

/** Minimum hit area for a primary control. */
const MIN_TAP = 24;

const problems = [];
let total = 0;

function check(name, passed, detail = "") {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 40000 })
    .catch(() => {});
  await page.waitForTimeout(350);
}

/* Each viewport seeds a cart, which is a database row. The QA session makes
   those rows identifiable and guarantees they are purged afterwards. */
const qa = await startQaSession("responsive", BASE);

const browser = await chromium.launch();
const routes = Object.entries(ROUTES);

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    isMobile: width <= 480,
    hasTouch: width <= 480,
  });
  await ctx.addCookies([qa.cookie]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${width}] pageerror: ${String(e).slice(0, 160)}`));

  /* Seed a cart so cart-bearing routes render their real layout, which is the
     one most likely to overflow, rather than their empty state.

     Seeded through the cart API rather than by writing localStorage: the cart
     now lives in PostgreSQL behind a session cookie, so a localStorage key is
     no longer the store and writing one seeds nothing. */
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    for (const productId of ["electronics-03", "home-kitchen-05"]) {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setQty",
          productId,
          qty: productId === "electronics-03" ? 2 : 1,
        }),
      }).catch(() => {});
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          productId,
          qty: productId === "electronics-03" ? 2 : 1,
        }),
      }).catch(() => {});
    }
  });

  for (const [label, route] of routes) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await settle(page);

    const m = await page.evaluate(
      ({ vw, minTap }) => {
        const offenders = [];

        for (const el of document.body.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") continue;
          if (r.right <= vw + 1 && r.left >= -1) continue;

          /* A closed panel parked past the edge is intentional. It only counts
             if it is genuinely exposed - visible, not hidden from assistive
             tech, and not inside an overflow-clipping ancestor. */
          let skip = false;
          for (let p = el; p; p = p.parentElement) {
            const pcs = getComputedStyle(p);
            if (/hidden|clip|auto|scroll/.test(pcs.overflowX)) { skip = true; break; }
            if (pcs.visibility === "hidden") { skip = true; break; }
            if (p.getAttribute && p.getAttribute("aria-hidden") === "true") { skip = true; break; }
          }
          if (skip) continue;

          offenders.push(
            `${el.tagName.toLowerCase()}${el.dataset?.testid ? `[${el.dataset.testid}]` : ""} @${Math.round(r.left)}..${Math.round(r.right)}`
          );
        }

        /*
          Tap targets are measured by what a finger actually hits, not by the
          element's own box. A control may legitimately render smaller than the
          minimum and extend its hit area with a pseudo-element - the .tap-target
          utility does exactly that - and a getBoundingClientRect check cannot
          see it. So probe the points a thumb would land on instead.
        */
        const hits = (el, x, y) => {
          const top = document.elementFromPoint(x, y);
          if (!top) return false;
          return top === el || el.contains(top) || top.contains(el);
        };

        const small = [];
        for (const el of document.querySelectorAll("button, a[href], select, input[type=submit]")) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          if (getComputedStyle(el).visibility === "hidden") continue;
          if (r.right < 0 || r.left > vw) continue; // parked off-canvas
          if (r.height >= minTap || r.width >= 40) continue; // box is big enough

          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const reach = minTap / 2 - 1;
          const covered =
            hits(el, cx, cy - reach) &&
            hits(el, cx, cy + reach) &&
            hits(el, cx, cy);

          if (!covered) {
            const name = (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24);
            small.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }

        return {
          scrollWidth: document.documentElement.scrollWidth,
          offenders: offenders.slice(0, 6),
          small: small.slice(0, 6),
        };
      },
      { vw: width, minTap: MIN_TAP }
    );

    check(`${label} @${width} no horizontal scroll`, m.scrollWidth <= width + 1,
      m.scrollWidth > width + 1 ? `scrollWidth ${m.scrollWidth} vs ${width}` : "");
    check(`${label} @${width} nothing escapes the viewport`, m.offenders.length === 0, m.offenders.join(" | "));
    check(`${label} @${width} controls are hittable`, m.small.length === 0, m.small.join(" | "));

    if (width === 1440 || width === 390) {
      await page.screenshot({ path: path.join(OUT, `${label}-${width}.png`), fullPage: false });
    }
  }

  await ctx.close();
}

await browser.close();

/*
  PENDING wave 1 - cannot be asserted until BottomTabs exists:
    - a bottom tab bar is present and reachable at <= 480px
    - sticky bottom chrome respects env(safe-area-inset-bottom)
    - the tab bar and any other sticky bottom bar do not overlap
  Listed in COVERAGE.md. Deliberately not stubbed.
*/

console.log(`\n${total - problems.length}/${total} responsive checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
