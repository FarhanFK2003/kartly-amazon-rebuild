// Renders a labelled contact sheet of the highest-impact catalogue imagery so
// it can be judged visually in one pass rather than by filename.
//
//   node scripts/contact-sheet.mjs <outDir> [all]
//
// Default scope is the homepage-critical set: the top four products by review
// count in each department, which is what feeds the department tiles, the hero
// slides and the four-up card rows.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || ".";
const SCOPE = process.argv[3] === "all" ? "all" : "hero";
fs.mkdirSync(OUT, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));

const picks = [];
for (const c of catalog.categories) {
  const inCat = catalog.products
    .filter((p) => p.categoryId === c.id)
    .sort((a, b) => b.reviewCount - a.reviewCount);
  const take = SCOPE === "all" ? inCat : inCat.slice(0, 4);
  take.forEach((p, i) =>
    picks.push({
      id: p.id,
      category: c.name,
      role: i === 0 ? "TILE+HERO" : "card row",
      term: p.imageQuery,
      title: p.title.split(",")[0],
      image: p.image,
    })
  );
}

const cells = picks
  .map(
    (p) => `
  <figure>
    <img src="file://${path.join(ROOT, "public").replace(/\\/g, "/")}${p.image}" alt="">
    <figcaption>
      <b class="${p.role === "TILE+HERO" ? "hero" : ""}">${p.category}${p.role === "TILE+HERO" ? " - TILE" : ""}</b>
      <span>${p.id}</span>
      <span class="term">want: ${p.term}</span>
    </figcaption>
  </figure>`
  )
  .join("");

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; background: #fff; }
  .grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
  figure { margin: 0; }
  img { width: 100%; aspect-ratio: 1; object-fit: contain; background: #f3f4f4; border: 1px solid #ddd; }
  figcaption { font-size: 10px; line-height: 1.25; margin-top: 2px; }
  figcaption b { display: block; }
  figcaption b.hero { color: #c7511f; }
  figcaption span { display: block; color: #666; }
  figcaption .term { color: #0a7; }
</style>
<div class="grid">${cells}</div>`;

const file = path.join(OUT, "sheet.html");
fs.writeFileSync(file, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`file://${file.replace(/\\/g, "/")}`, { waitUntil: "load" });
await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
await page.screenshot({ path: path.join(OUT, `contact-${SCOPE}.png`), fullPage: true });
await browser.close();

console.log(`contact sheet: ${picks.length} images -> ${path.join(OUT, `contact-${SCOPE}.png`)}`);
