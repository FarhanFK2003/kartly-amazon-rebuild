// Downloads one product image per catalog entry into public/products/.
//
// Source: the Openverse API. Defaults to license=cc0,pdm so most of the repo
// carries no attribution obligation; a small, explicitly listed set of
// high-visibility products widens to CC-BY where the public-domain pool has no
// usable photograph of the product. Full provenance is recorded in
// data/image-sources.json and rendered into ATTRIBUTION.md.
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

/*
  Per-product image query overrides.

  A product's imageQuery doubles as a search keyword, so it cannot be edited to
  suit the photo pool. These overrides change only what we search Openverse for.

  Each entry is here because the product's natural term returns nothing usable
  under a CC0-only filter, and the product occupies a high-visibility slot: the
  homepage department tiles and the four-up card rows. Verified by eye on a
  contact sheet, not by filename.
*/
const IMAGE_OVERRIDES = {
  // department tiles (largest images on the homepage)
  "home-kitchen-05": "kitchen knife",      // was a fridge interior
  "fashion-08": "wristwatch",              // was an art-deco building
  "beauty-11": "cosmetics makeup",        // was a tropical island
  "toys-12": "crayons",           // was an empty studio room
  "books-06": "book",            // was a classical painting
  "office-09": "office stationery",        // was cardboard boxes

  // four-up card row tiles
  "electronics-02": "earbuds",           // was a charging dock
  "electronics-06": "loudspeaker",         // was an indistinct wall
  "computers-03": "personal computer",        // was abstract wallpaper
  "home-kitchen-10": "skillet",            // was a bear
  "sports-10": "cooler",            // was a bee
  "sports-05": "headlamp",               // was a phone screenshot
  "beauty-02": "cosmetic cream jar",              // was a bee
  "beauty-08": "makeup mirror",            // was a monochrome bedroom
  "books-01": "open book pages",                 // was an abstract sculpture
  "toys-04": "jigsaw puzzle pieces",                     // was a tablet landscape
  "pets-05": "pet bowl",              // was a fish pond
  "pets-03": "dog leash",                  // was a grey sculpture
  "fashion-02": "sneakers",                // was shoes on an overhead wire

  /*
    This one is not a relevance override, it is a safety one.

    "t-shirt clothing" ranked a paparazzi candid of an identifiable celebrity,
    in a state of undress, above every photograph of an actual shirt - and it
    carried a Public Domain Mark, so the licence filter passed it straight
    through. A licence filter says what you may reuse, never what is
    appropriate to reuse. Searching for the garment rather than the category
    returns garments.
  */
  "fashion-03": "folded t-shirt",          // was a celebrity beach candid
};

/*
  Products allowed to draw on attribution-required licences.

  CC0 and Public Domain Mark carry no attribution obligation, which is why they
  are the default. But the CC0 pool contains almost no product photography for
  some terms, and for these slots a wrong image costs more than a credit line:
  the CC0 results for "earphones" and "art supplies" were anime fan art and a
  Lorem ipsum graphic.

  These fall back to CC-BY / CC-BY-SA, which are legally fine to redistribute in
  a public repository provided the creator is credited - and every image's
  creator and licence is already recorded in ATTRIBUTION.md.
*/
const LICENCE_WIDENED = new Set([
  "beauty-11", "toys-12", "books-06",                       // department tiles
  "electronics-02", "electronics-06", "computers-03",
  "sports-10", "sports-05", "beauty-02", "books-01",
  "toys-04", "pets-05",
]);

/*
  Pinned images: product id -> a specific Openverse image id.

  A search override picks a better pool; it cannot pick a specific photograph,
  and ranking is not review. The pool for "folded t-shirt" contains both clean
  apparel shots and a 1995 conference tee covered in someone else's branding,
  and which one comes back depends on the API's ordering and its size filter on
  the day. Where a slot has been checked by eye, pinning the exact image is the
  only way to keep that check meaningful across re-runs.
*/
const PINNED = {
  // Verified by eye: a fanned stack of folded jersey tees, no people, no
  // third-party branding, CC0. Replaces a celebrity beach candid.
  "fashion-03": "7e40b7d4-5c22-4554-9b40-1e1e6cb1d423",

  /*
    Both of these replace photographs carrying another site's watermark across
    the frame, which is the most placeholder-looking thing a storefront can
    show. office-09 also supplies the Office Products tile on the homepage,
    because the tile takes the most-reviewed product of its department - so one
    watermarked product photo was being shown twice, once above the fold.

    Openverse's CC0 pool has a lot of this: several stock sites publish
    watermarked previews under a free licence, and the licence filter cannot
    see a watermark. Both replacements were checked by eye.
  */
  // was "Colorful sketch pens" stamped with readysetimages.com
  "office-09": "630f3294-687d-4c41-ac35-9c314698294c",
  // was a man in a Tokyo manga shop stamped with magneticman.com
  "books-10": "a558706e-e4f3-47d7-a03b-ae94de86edf1",
};

/*
  Image filename overrides.

  A filename normally follows the product slug, which keeps the directory
  readable. That filename is also the image URL, and Next serves optimised
  images with a four hour max-age keyed on it. Replacing a file in place leaves
  every browser, proxy and deployment image cache serving the old bytes at the
  same URL until it expires - there is nothing in the request for a cache to
  notice.

  For a merely wrong photo that is a nuisance you can wait out. For an
  inappropriate one it is not acceptable, because the old image stays reachable
  and keeps being shown. Changing the filename changes the URL, so every cache
  misses and the previous bytes cannot come back.
*/
const IMAGE_FILE_OVERRIDES = {
  "fashion-03": "orvan-everyday-merino-wool-crew-t-shirt-fashion-03-v2.jpg",
  "office-09": "kestrel-sort-a4-laminator-office-09-v2.jpg",
  "books-10": "nightjar-crime-thriller-books-10-v2.jpg",
};

async function fetchPinned(id) {
  return getJson(`https://api.openverse.org/v1/images/${id}/`);
}

const queryFor = (product) => IMAGE_OVERRIDES[product.id] ?? product.imageQuery;

/* ---------- group products by search term ---------- */

const byQuery = new Map();
for (const p of catalog.products) {
  const key = queryFor(p);
  if (!byQuery.has(key)) byQuery.set(key, []);
  byQuery.get(key).push(p);
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
    const licences = pending.some((p) => LICENCE_WIDENED.has(p.id)) ? "cc0,pdm,by,by-sa" : "cc0,pdm";
    const url =
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}` +
      `&license=${licences}&size=medium&mature=false&page_size=${Math.min(40, Math.max(20, pending.length + 12))}`;
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
    const file = IMAGE_FILE_OVERRIDES[product.id] ?? `${product.slug}.jpg`;
    const dest = path.join(OUT_DIR, file);
    let done = false;

    // A pinned image is fetched by id and tried first. If it ever disappears
    // upstream, this falls through to the ranked pool rather than failing.
    if (PINNED[product.id] && !openverseDead) {
      try {
        const hit = await fetchPinned(PINNED[product.id]);
        pool.unshift(hit);
      } catch (err) {
        console.warn(`  ! pinned image for ${product.id}: ${err.message}`);
      }
    }

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

const entries = Object.entries(sources).filter(([, r]) => r.source !== "local");
const requiresAttribution = (r) => /^(by|by-sa|by-nc|by-nd)/.test(r.license || "");
const attributed = entries.filter(([, r]) => requiresAttribution(r));
const publicDomain = entries.filter(([, r]) => !requiresAttribution(r));

const row = ([id, r]) => {
  const licence = r.licenseUrl ? `[${r.license}](${r.licenseUrl})` : r.license;
  const title = r.landingUrl ? `[${r.title || "untitled"}](${r.landingUrl})` : r.title || "-";
  return `| ${id} | ${title} | ${r.creator || "-"} | ${licence} | ${r.source} |`;
};

const HEAD = "| Product | Title | Creator | Licence | Source |\n|---|---|---|---|---|";

fs.writeFileSync(
  path.join(ROOT, "ATTRIBUTION.md"),
  `# Image attribution

Kartly is a demo storefront. Product photography comes from [Openverse](https://openverse.org).

Images are downloaded at catalogue build time and committed to this repository, so the deployed
site makes no runtime request to any third-party image host.

## Licensing

| | Count |
|---|---|
| CC0 / Public Domain Mark (no attribution required) | ${publicDomain.length} |
| CC-BY / CC-BY-SA (**attribution required**, credited below) | ${attributed.length} |

Most imagery is CC0 or Public Domain Mark. A small number of slots - mainly the homepage
department tiles - had no usable public-domain photograph of the actual product, and a clearly
wrong image costs more than a credit line, so those draw on CC-BY and CC-BY-SA instead. Every
one is credited below with its creator, licence and original page.

## Attribution required

These ${attributed.length} images are used under CC-BY or CC-BY-SA. Credit is given to the
creator; the licence link states the terms, and CC-BY-SA works are redistributed unmodified
under the same licence.

${HEAD}
${attributed.map(row).join("\n")}

## Public domain / CC0

No attribution is required for these; they are credited anyway.

${HEAD}
${publicDomain.map(row).join("\n")}
`
);

console.log(`\n\nimages complete`);
console.log(`  already on disk : ${stats.cached}`);
console.log(`  openverse       : ${stats.openverse}`);
console.log(`  loremflickr     : ${stats.flickr}`);
console.log(`  placeholder     : ${stats.placeholder}`);
