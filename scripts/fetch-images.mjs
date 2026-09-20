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
// Fallback chain per product: Openverse -> loremflickr -> generated PNG.
// Re-running is cheap: anything already on disk and recorded is skipped.

import fs from "node:fs";
import zlib from "node:zlib";
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

  // Content-type alone is not enough: Openverse serves some SVG assets, which
  // pass an "image/*" check but are not raster data. Written to a .jpg path they
  // break Next's image optimizer at request time rather than at build time, so
  // verify the actual magic bytes.
  if (!isRaster(buf)) throw new Error(`not raster data (${type})`);

  fs.writeFileSync(dest, buf);
  return buf.length;
}

function isRaster(buf) {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf[0] === 0x89 && buf.subarray(1, 4).toString("ascii") === "PNG";
  const gif = buf.subarray(0, 3).toString("ascii") === "GIF";
  const webp =
    buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  return jpeg || png || gif || webp;
}

/* ---------- raster placeholder ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Last-resort placeholder, written as a real PNG.
 *
 * It used to be an SVG with a .jpg extension, which sailed past every check and
 * then failed inside Next's image optimizer at request time. A raster fallback
 * cannot poison the pipeline that way.
 */
function writePlaceholder(dest) {
  const size = 600;
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inBox = x > 170 && x < 430 && y > 170 && y < 430;
      const [r, g, b] = inBox ? [226, 229, 229] : [243, 244, 244];
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(dest.replace(/\.jpg$/, ".png"), png);
}

/* ---------- group products by search term ---------- */

const byQuery = new Map();
for (const p of catalog.products) {
  if (!byQuery.has(p.imageQuery)) byQuery.set(p.imageQuery, []);
  byQuery.get(p.imageQuery).push(p);
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
  "thermal clothing": "wool sweater",
  "consumer electronics": "electronics",
};

/**
 * Openverse ranks by its own relevance, which under a CC0-only filter surfaces a
 * lot of documentary photography that merely mentions the term. Re-rank locally:
 * a result whose title or tags actually contain the search words, and whose
 * framing is roughly square, is far more likely to depict the product.
 */
function scoreHit(hit, query) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const title = (hit.title || "").toLowerCase();
  const tags = (hit.tags || []).map((t) => (typeof t === "string" ? t : t.name || "")).join(" ").toLowerCase();

  let score = 0;
  for (const w of words) {
    if (title.includes(w)) score += 3;
    else if (tags.includes(w)) score += 2;
  }
  // A title that is *only* the product term is the strongest signal there is.
  if (words.length && words.every((w) => title.includes(w)) && title.length < 40) score += 3;

  if (hit.width && hit.height) {
    const ratio = hit.width / hit.height;
    if (ratio > 0.7 && ratio < 1.45) score += 2;
    else if (ratio > 0.55 && ratio < 1.9) score += 1;
  }
  return score;
}

let openverseDead = false;
const stats = { cached: 0, openverse: 0, flickr: 0, placeholder: 0 };

/* ---------- main ---------- */

const queries = [...byQuery.entries()];
for (let qi = 0; qi < queries.length; qi++) {
  const [query, items] = queries[qi];

  const pending = items.filter((p) => {
    const rec = sources[p.id];
    if (!rec) return true;
    return !fs.existsSync(path.join(OUT_DIR, rec.file));
  });
  stats.cached += items.length - pending.length;
  if (pending.length === 0) continue;

  // One API call per distinct term, asking for enough results to give every
  // product sharing that term a different photo.
  // Results from the primary and fallback terms are pooled together rather than
  // the fallback only firing when the primary returns too few. A term can return
  // plenty of results that are all unusable (vector data), and a count check
  // cannot see that.
  let results = [];
  const attempts = [query, QUERY_FALLBACKS[query]].filter(Boolean);
  for (const term of attempts) {
    if (openverseDead) break;
    const url =
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}` +
      `&license=cc0,pdm&size=medium&mature=false&page_size=${Math.min(40, Math.max(20, pending.length + 12))}`;
    try {
      const data = await getJson(url);
      results = results.concat(data.results || []);
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

  // Shared pool: a result that fails (vector data, dead link, too small) is
  // discarded and the next product takes the one after it, rather than every
  // product being locked to a single fixed index.
  const pool = [...results]
    .map((hit) => ({ hit, score: scoreHit(hit, query) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.hit);

  for (let i = 0; i < pending.length; i++) {
    const product = pending[i];
    const file = `${product.slug}.jpg`;
    const dest = path.join(OUT_DIR, file);
    let done = false;

    while (!done && pool.length > 0) {
      const hit = pool.shift();
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
          /* try the next candidate URL, then the next result */
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
      sources[product.id] = { file: file.replace(/\.jpg$/, ".png"), query, license: "Generated placeholder", source: "local" };
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
