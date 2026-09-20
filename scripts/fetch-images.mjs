// Downloads one product image per catalog entry into public/products/.
//
// Source: the Openverse API, filtered to license=cc0,pdm (CC0 and Public Domain
// Mark) so nothing in the repo carries an attribution obligation. We still record
// full provenance in data/image-sources.json and render ATTRIBUTION.md from it,
// because crediting the photographer is the decent thing to do regardless.
//
// Images are downloaded once and committed, so the deployed site never depends
// on a third-party host at runtime.
//
// Fallback chain per product: Openverse -> loremflickr -> generated SVG.
// Re-running is cheap: anything already on disk and recorded is skipped.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "products");
const CATALOG = path.join(ROOT, "data", "catalog.json");
const SOURCES = path.join(ROOT, "data", "image-sources.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
fs.mkdirSync(OUT_DIR, { recursive: true });

const sources = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, "utf8")) : {};

/* ---------- helpers ---------- */

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "kartly-demo-catalog/1.0 (educational project)" },
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "kartly-demo-catalog/1.0 (educational project)" },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error(`suspiciously small (${buf.length}b)`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

/** Last-resort placeholder so the grid never shows a broken image. */
function writePlaceholder(dest, label) {
  const initials = label.replace(/[^a-zA-Z ]/g, "").split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="#f3f4f4"/>
  <circle cx="300" cy="258" r="96" fill="#e2e5e5"/>
  <text x="300" y="286" font-family="Inter,Arial,sans-serif" font-size="72" font-weight="600" fill="#9aa0a0" text-anchor="middle">${initials}</text>
  <text x="300" y="420" font-family="Inter,Arial,sans-serif" font-size="24" fill="#9aa0a0" text-anchor="middle">Product image</text>
</svg>`;
  fs.writeFileSync(dest.replace(/\.jpg$/, ".svg"), svg);
}

/* ---------- group products by search term ---------- */

const byQuery = new Map();
for (const p of catalog.products) {
  if (!byQuery.has(p.imageQuery)) byQuery.set(p.imageQuery, []);
  byQuery.get(p.imageQuery).push(p);
}
for (const c of catalog.categories) {
  const key = `__category__${c.imageQuery}`;
  if (!byQuery.has(key)) byQuery.set(key, []);
  byQuery.get(key).push({ id: `category-${c.id}`, slug: `category-${c.id}`, title: c.name, imageQuery: c.imageQuery, isCategory: true });
}

// Some product terms return nothing usable under a CC0-only filter. These are
// broader synonyms tried as a second pass before dropping to loremflickr.
const QUERY_FALLBACKS = {
  "cookware set": "saucepan",
  "headlamp torch": "flashlight",
  "hair clipper": "barber scissors",
  "silk pillowcase": "pillow",
  "pet grooming brush": "hairbrush",
  "cat litter mat": "cat",
  "lint roller": "cleaning brush",
  "outdoor camping gear": "camping",
  "consumer electronics": "electronics",
};

let openverseDead = false;
const stats = { cached: 0, openverse: 0, flickr: 0, placeholder: 0 };

/* ---------- main ---------- */

const queries = [...byQuery.entries()];
for (let qi = 0; qi < queries.length; qi++) {
  const [rawQuery, items] = queries[qi];
  const query = rawQuery.replace("__category__", "");

  const pending = items.filter((p) => {
    const rec = sources[p.id];
    if (!rec) return true;
    return !fs.existsSync(path.join(OUT_DIR, rec.file));
  });
  stats.cached += items.length - pending.length;
  if (pending.length === 0) continue;

  // One API call per distinct term, asking for enough results to give every
  // product sharing that term a different photo.
  let results = [];
  const attempts = [query, QUERY_FALLBACKS[query]].filter(Boolean);
  for (const term of attempts) {
    if (openverseDead || results.length >= pending.length) break;
    const url =
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}` +
      `&license=cc0,pdm&size=medium&mature=false&page_size=${Math.max(6, pending.length + 4)}`;
    try {
      const data = await getJson(url);
      results = data.results || [];
      await sleep(350); // stay well inside the anonymous rate limit
    } catch (err) {
      if (String(err.message).includes("RATE_LIMIT")) {
        console.warn(`  ! Openverse rate limited - falling back to loremflickr for the rest`);
        openverseDead = true;
      } else {
        console.warn(`  ! Openverse "${term}": ${err.message}`);
      }
      await sleep(600);
    }
  }

  for (let i = 0; i < pending.length; i++) {
    const product = pending[i];
    const file = `${product.slug}.jpg`;
    const dest = path.join(OUT_DIR, file);
    const hit = results[i];
    let done = false;

    if (hit) {
      for (const candidate of [hit.thumbnail, hit.url].filter(Boolean)) {
        try {
          const bytes = await download(candidate, dest);
          sources[product.id] = {
            file,
            query,
            title: hit.title || null,
            creator: hit.creator || null,
            license: `${hit.license}${hit.license_version ? " " + hit.license_version : ""}`,
            licenseUrl: hit.license_url || null,
            source: hit.source || hit.provider || null,
            landingUrl: hit.foreign_landing_url || null,
            bytes,
          };
          stats.openverse++;
          done = true;
          break;
        } catch {
          /* try the next candidate URL */
        }
      }
    }

    if (!done) {
      try {
        const seed = Math.abs([...product.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 9999;
        const bytes = await download(`https://loremflickr.com/600/600/${encodeURIComponent(query)}?lock=${seed}`, dest);
        sources[product.id] = { file, query, license: "Flickr (see loremflickr.com)", source: "loremflickr", bytes };
        stats.flickr++;
        done = true;
      } catch {
        /* fall through to placeholder */
      }
    }

    if (!done) {
      writePlaceholder(dest, product.title);
      sources[product.id] = { file: file.replace(/\.jpg$/, ".svg"), query, license: "Generated placeholder", source: "local" };
      stats.placeholder++;
    }
  }

  const label = `${qi + 1}/${queries.length}`;
  process.stdout.write(`\r  ${label} ${query.slice(0, 28).padEnd(28)} ov:${stats.openverse} fl:${stats.flickr} ph:${stats.placeholder}   `);
}

fs.writeFileSync(SOURCES, JSON.stringify(sources, null, 2) + "\n");

/* ---------- write image paths back into the catalog ---------- */

for (const p of catalog.products) {
  const rec = sources[p.id];
  p.image = rec ? `/products/${rec.file}` : null;
}
for (const c of catalog.categories) {
  const rec = sources[`category-${c.id}`];
  c.image = rec ? `/products/${rec.file}` : null;
}
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n");

/* ---------- attribution ---------- */

const rows = Object.entries(sources)
  .filter(([, r]) => r.source !== "local")
  .map(([id, r]) => `| ${id} | ${r.title || "-"} | ${r.creator || "-"} | ${r.license} | ${r.source} |`)
  .join("\n");

fs.writeFileSync(
  path.join(ROOT, "ATTRIBUTION.md"),
  `# Image attribution

Kartly is a demo storefront. Product photography is sourced from [Openverse](https://openverse.org)
filtered to **CC0 / Public Domain Mark**, which carries no attribution requirement. Credits are
listed here anyway.

Images are downloaded at catalog build time and committed, so the deployed site makes no
runtime requests to any third-party image host.

| Product | Title | Creator | License | Source |
|---|---|---|---|---|
${rows}
`
);

console.log(`\n\nimages complete`);
console.log(`  already on disk : ${stats.cached}`);
console.log(`  openverse       : ${stats.openverse}`);
console.log(`  loremflickr     : ${stats.flickr}`);
console.log(`  placeholder     : ${stats.placeholder}`);
