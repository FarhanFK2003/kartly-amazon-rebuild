// Expands scripts/product-seeds.mjs into data/catalog.json.
//
// Every derived field (rating, review count, deal, stock, badges, reviews) comes
// from a PRNG seeded on the product id, so the catalog is byte-identical on
// every run. That keeps the committed JSON diff-free unless the seeds change.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, SEEDS } from "./product-seeds.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- deterministic randomness ---------- */

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngFor = (seed) => mulberry32(hashString(seed));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const intBetween = (rnd, min, max) => Math.floor(rnd() * (max - min + 1)) + min;

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/* ---------- review generation ---------- */

const FIRST_NAMES = ["Amara", "Daniel", "Priya", "Marcus", "Elena", "Tom", "Nadia", "Chris", "Yusuf", "Hannah", "Leo", "Sofia", "Ben", "Aisha", "Martin", "Clare", "Raj", "Freya", "Owen", "Mei", "Jonas", "Ivy", "Samir", "Greta", "Paul", "Noor", "Alex", "Rosa", "Felix", "Tara"];
const LAST_INITIALS = ["A.", "B.", "C.", "D.", "F.", "H.", "K.", "L.", "M.", "N.", "P.", "R.", "S.", "T.", "W."];

const POSITIVE_TITLES = ["Exactly what I was after", "Genuinely impressed", "Better than I expected for the price", "Would buy again without hesitating", "Has replaced the one I had for years", "Well made and it shows", "Worth every penny", "Does the job properly", "Really pleased with this", "Solid buy"];
const MIXED_TITLES = ["Good, with one caveat", "Nearly perfect", "Does most things well", "Fine for the money", "Happy overall but read the details", "Decent, a few rough edges"];
const NEGATIVE_TITLES = ["Not for me", "Disappointing after a few weeks", "Looks better than it performs", "Expected more at this price", "Sent it back"];

const POSITIVE_BODIES = [
  "Arrived two days early and the packaging was sensible, no giant box for a small item. Build quality is a clear step up from the one this replaced, and after {weeks} weeks of daily use there is no sign of wear. If you are hesitating over the price, I would say it is justified.",
  "I bought this after reading through a lot of reviews and I am glad I did. It does exactly what the listing describes, nothing overstated. Setup took about ten minutes. The only reason I mention that is that the last one I owned took an afternoon.",
  "Using this every day for {weeks} weeks now. It has handled everything I have put it through and still looks new. The finish in particular is much nicer in person than the photos suggest.",
  "Genuinely good. I ordered one, then ordered a second a fortnight later because the first worked so well. That is the most honest recommendation I can give.",
  "Straightforward, well built and it does the one thing it is supposed to do properly. No app to install, no account to make, it just works. More things should be like this.",
  "Replaced a much more expensive item with this and honestly cannot tell the difference in day to day use. Very happy with the decision.",
];
const MIXED_BODIES = [
  "Mostly very good. The build and finish are excellent for the money. My only complaint is that the instructions are thin, so the first setup involved more guesswork than it needed to. Once it was going, no issues at all.",
  "Does what it says and I use it daily. Knocked a star off because it is slightly bigger than I pictured from the listing photos. Measure first and you will be fine.",
  "Quality is there, no question. I would have liked a carry case included at this price, and the cable is a little short for my setup. Neither is a dealbreaker.",
  "Works well and feels durable. Took a week to get used to after the one I had before, which is on me rather than the product, but worth mentioning if you are switching.",
];
const NEGATIVE_BODIES = [
  "It is not badly made, it just was not right for what I needed. That is partly my fault for not reading the dimensions carefully. Returns were painless at least.",
  "Worked well for the first month and then developed a fault. Support replaced it quickly, which I appreciate, but I would have preferred it to simply keep working.",
  "Fine, but I think there are better options at this price now. Nothing actively wrong with it, it just did not stand out.",
];

function buildReviews(rnd, productId, rating, reviewCount) {
  const n = intBetween(rnd, 4, 7);
  const out = [];
  const now = Date.UTC(2026, 8, 20);
  for (let i = 0; i < n; i++) {
    // Skew the sample towards the product's real rating so the list and the
    // histogram tell the same story.
    const roll = rnd();
    let stars;
    if (rating >= 4.5) stars = roll < 0.75 ? 5 : roll < 0.93 ? 4 : 3;
    else if (rating >= 4.0) stars = roll < 0.5 ? 5 : roll < 0.82 ? 4 : roll < 0.95 ? 3 : 2;
    else stars = roll < 0.3 ? 5 : roll < 0.58 ? 4 : roll < 0.82 ? 3 : roll < 0.94 ? 2 : 1;

    const bucket = stars >= 5 ? "pos" : stars >= 3 ? "mix" : "neg";
    const title = pick(rnd, bucket === "pos" ? POSITIVE_TITLES : bucket === "mix" ? MIXED_TITLES : NEGATIVE_TITLES);
    const body = pick(rnd, bucket === "pos" ? POSITIVE_BODIES : bucket === "mix" ? MIXED_BODIES : NEGATIVE_BODIES)
      .replace("{weeks}", String(intBetween(rnd, 3, 14)));

    const daysAgo = intBetween(rnd, 3, 420);
    out.push({
      id: `${productId}-r${i + 1}`,
      author: `${pick(rnd, FIRST_NAMES)} ${pick(rnd, LAST_INITIALS)}`,
      rating: stars,
      title,
      body,
      date: new Date(now - daysAgo * 86400000).toISOString().slice(0, 10),
      verified: rnd() < 0.86,
      helpful: Math.max(0, Math.floor(Math.pow(rnd(), 2.2) * Math.min(reviewCount / 8, 240))),
    });
  }
  return out.sort((a, b) => b.helpful - a.helpful);
}

/**
 * Five bucket counts that sum to reviewCount and whose weighted mean lands on
 * the displayed rating.
 *
 * Real rating distributions are J-shaped, not bell-shaped: a 4.6-star product is
 * mostly 5s with a thin tail all the way down to 1, never a clean gradient with
 * empty low buckets. So we use an exponential decay away from 5 plus a small
 * floor to guarantee the tail exists, and binary-search the decay constant until
 * the weighted mean matches the displayed rating.
 */
function buildHistogram(rating, reviewCount) {
  const FLOOR = 0.015;
  const stars = [5, 4, 3, 2, 1];

  const weightsFor = (lambda) => stars.map((s) => Math.exp(-lambda * (5 - s)) + FLOOR);
  const meanFor = (lambda) => {
    const w = weightsFor(lambda);
    const total = w.reduce((a, b) => a + b, 0);
    return stars.reduce((acc, s, i) => acc + s * (w[i] / total), 0);
  };

  // meanFor is monotonically increasing in lambda.
  let lo = -6;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (meanFor(mid) < rating) lo = mid;
    else hi = mid;
  }

  const w = weightsFor((lo + hi) / 2);
  const total = w.reduce((a, b) => a + b, 0);
  const exact = w.map((x) => (x / total) * reviewCount);

  // Largest-remainder rounding keeps the buckets summing to reviewCount.
  const counts = exact.map(Math.floor);
  let drift = reviewCount - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; drift > 0; k++, drift--) counts[order[k % 5].i]++;

  // Never show a bucket as literally zero when there are reviews to spare.
  for (let i = 0; i < 5; i++) {
    if (counts[i] === 0 && reviewCount >= 40 && counts[0] > 2) {
      counts[i] = 1;
      counts[0]--;
    }
  }

  return { 5: counts[0], 4: counts[1], 3: counts[2], 2: counts[3], 1: counts[4] };
}

/* ---------- product expansion ---------- */

const products = [];
const categories = CATEGORIES.map((c) => ({ id: c.id, name: c.name, blurb: c.blurb, slug: c.id, imageQuery: c.q }));

for (const category of CATEGORIES) {
  const seeds = SEEDS[category.id] || [];
  seeds.forEach((seed, index) => {
    const id = `${category.id}-${String(index + 1).padStart(2, "0")}`;
    const rnd = rngFor(id);

    const rating = Math.round((3.6 + Math.pow(rnd(), 0.7) * 1.3) * 10) / 10;
    const reviewCount = Math.max(11, Math.floor(Math.pow(rnd(), 2.6) * 14000) + intBetween(rnd, 11, 260));

    // ~38% of the catalog carries a visible discount.
    const hasDeal = rnd() < 0.38;
    const dealPercent = hasDeal ? intBetween(rnd, 8, 45) : 0;
    const listPrice = hasDeal ? Math.round(seed.p / (1 - dealPercent / 100) / 100) * 100 - 1 : null;

    const stock = rnd() < 0.14 ? intBetween(rnd, 1, 9) : intBetween(rnd, 25, 400);

    products.push({
      id,
      slug: `${slugify(seed.t.split(",")[0])}-${id}`,
      title: seed.t,
      brand: seed.b,
      categoryId: category.id,
      price: seed.p,
      listPrice,
      dealPercent,
      rating,
      reviewCount,
      ratingHistogram: buildHistogram(rating, reviewCount),
      image: null, // filled in by scripts/fetch-images.mjs
      imageQuery: seed.q,
      bullets: seed.bl,
      specs: seed.sp,
      variants: (seed.v || []).map((v, i) => ({
        id: `${id}-v${i + 1}`,
        type: v.type,
        label: v.label,
        swatch: v.swatch ?? null,
        priceDelta: v.priceDelta ?? 0,
      })),
      stock,
      isPrime: rnd() < 0.82,
      deliveryDays: intBetween(rnd, 1, 5),
      boughtLastMonth: rnd() < 0.55 ? [50, 100, 200, 500, 1000, 2000][intBetween(rnd, 0, 5)] : 0,
      badges: [],
      reviews: buildReviews(rnd, id, rating, reviewCount),
    });
  });
}

/* ---------- badges, assigned across the whole catalog ---------- */

for (const category of categories) {
  const inCategory = products.filter((p) => p.categoryId === category.id);
  const byReviews = [...inCategory].sort((a, b) => b.reviewCount - a.reviewCount);
  if (byReviews[0]) byReviews[0].badges.push("bestSeller");

  const byRating = [...inCategory].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  for (const p of byRating.slice(0, 2)) if (!p.badges.includes("bestSeller")) p.badges.push("choice");
}
for (const p of products) {
  if (p.dealPercent >= 25) p.badges.push("deal");
  if (p.stock <= 9) p.badges.push("lowStock");
}
// A handful of sponsored placements, deterministic by position.
products.filter((_, i) => i % 17 === 3).forEach((p) => p.badges.push("sponsored"));

/* ---------- write ---------- */

const out = {
  generatedAt: "2026-09-20",
  currency: "USD",
  categories,
  products,
};

fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
const file = path.join(ROOT, "data", "catalog.json");
fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");

const deals = products.filter((p) => p.dealPercent > 0).length;
console.log(`catalog.json written`);
console.log(`  categories : ${categories.length}`);
console.log(`  products   : ${products.length}`);
console.log(`  reviews    : ${products.reduce((n, p) => n + p.reviews.length, 0)}`);
console.log(`  with deals : ${deals}`);
console.log(`  low stock  : ${products.filter((p) => p.stock <= 9).length}`);
