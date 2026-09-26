/**
 * The backend: PostgreSQL, Prisma and the product API.
 *
 * This suite exists to answer one question no screenshot can answer - is the
 * data real? So alongside the ordinary contract checks it does two things the
 * other suites do not:
 *
 *   * it reads the API's own source and follows every local import, asserting
 *     that no request path reaches data/catalog.json or lib/catalog.ts;
 *   * it changes a row in PostgreSQL, asks the API for that product, requires
 *     the response to have changed - and then puts the row back.
 *
 * A mock cannot pass the second one.
 *
 *   node scripts/qa/backend.mjs <output-dir>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
let total = 0;
const check = (name, passed, detail = "") => {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
};

const get = async (pathname) => {
  const res = await fetch(`${BASE}${pathname}`);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* left null; whichever check cares will report it */
  }
  return { res, text, json };
};

/* ---- 1-3. the database is reachable and seeded ------------------------- */

const health = await get("/api/health");
check("1. GET /api/health responds 200", health.res.status === 200, `${health.res.status}`);
check(
  "2. health reports a live PostgreSQL connection",
  health.json?.status === "ok" && health.json?.database === "postgresql",
  JSON.stringify(health.json)?.slice(0, 120)
);

const counts = health.json?.counts ?? {};
check(
  "3. the database contains the seeded catalogue",
  counts.categories === 10 &&
    counts.brands === 12 &&
    counts.products === 120 &&
    counts.variants === 83 &&
    counts.reviews === 672,
  JSON.stringify(counts)
);

/* ---- 4-8. the product collection --------------------------------------- */

const list = await get("/api/products");
check("4. GET /api/products responds 200", list.res.status === 200, `${list.res.status}`);
check(
  "5. it returns a page of products",
  Array.isArray(list.json?.products) && list.json.products.length === 16,
  `${list.json?.products?.length}`
);
check(
  "6. pagination describes the whole catalogue",
  list.json?.pagination?.total === 120 && list.json?.pagination?.totalPages === 8,
  JSON.stringify(list.json?.pagination)
);

const first = list.json?.products?.[0] ?? {};
const required = [
  "id",
  "slug",
  "title",
  "brand",
  "price",
  "rating",
  "reviewCount",
  "bullets",
  "specs",
  "variants",
  "reviews",
  "category",
];
const missing = required.filter((k) => first[k] === undefined);
check("7. a product carries its full shape", missing.length === 0, `missing: ${missing.join(",")}`);
check(
  "8. relations are joined, not stubbed",
  typeof first.brand === "string" &&
    first.brand.length > 0 &&
    typeof first.category?.name === "string",
  `${first.brand} / ${first.category?.name}`
);

/* ---- 9-13. filtering, paging and sorting happen in the database -------- */

const limited = await get("/api/products?limit=3");
check("9. limit is honoured", limited.json?.products?.length === 3, `${limited.json?.products?.length}`);

const byCategory = await get("/api/products?category=electronics&limit=100");
const catRows = byCategory.json?.products ?? [];
check(
  "10. category filtering returns only that category",
  catRows.length === 12 && catRows.every((p) => p.categoryId === "electronics"),
  `${catRows.length} rows`
);

const brandName = first.brand;
const byBrand = await get(`/api/products?brand=${encodeURIComponent(brandName)}&limit=100`);
const brandRows = byBrand.json?.products ?? [];
check(
  "11. brand filtering returns only that brand",
  brandRows.length > 0 && brandRows.every((p) => p.brand === brandName),
  `${brandName}: ${brandRows.length} rows`
);

const searched = await get("/api/products?q=wireless&limit=100");
const searchRows = searched.json?.products ?? [];
check(
  "12. text search matches title, brand or category",
  searchRows.length > 0 &&
    searchRows.every((p) =>
      [p.title, p.brand, p.category?.name].some((f) =>
        String(f).toLowerCase().includes("wireless")
      )
    ),
  `${searchRows.length} rows`
);

const asc = (await get("/api/products?sort=price-asc&limit=100")).json?.products ?? [];
const desc = (await get("/api/products?sort=price-desc&limit=100")).json?.products ?? [];
const ascending = asc.every((p, i) => i === 0 || asc[i - 1].price <= p.price);
const descending = desc.every((p, i) => i === 0 || desc[i - 1].price >= p.price);
check("13. sorting is applied in the database", ascending && descending, `asc=${ascending} desc=${descending}`);

/* ---- 14-16. bad input is rejected rather than silently coerced --------- */

const badSort = await get("/api/products?sort=cheapest");
check("14. an unknown sort is rejected", badSort.res.status === 400, `${badSort.res.status}`);

const badPage = await get("/api/products?page=abc");
check("15. a non-numeric page is rejected", badPage.res.status === 400, `${badPage.res.status}`);

const badLimit = await get("/api/products?limit=5000");
check("16. an oversized limit is rejected", badLimit.res.status === 400, `${badLimit.res.status}`);

/* ---- 17-19. the single-product route ----------------------------------- */

const byId = await get(`/api/products/${first.id}`);
check(
  "17. a product can be fetched by catalogue id",
  byId.res.status === 200 && byId.json?.product?.id === first.id,
  `${byId.res.status} ${byId.json?.product?.id}`
);

const bySlug = await get(`/api/products/${first.slug}`);
check(
  "18. the same product resolves by slug, as /dp/[id] does",
  bySlug.res.status === 200 && bySlug.json?.product?.id === first.id,
  `${bySlug.res.status}`
);

const unknown = await get("/api/products/definitely-not-a-product");
check("19. an unknown product is a 404", unknown.res.status === 404, `${unknown.res.status}`);

/* ---- 20. failures must not leak infrastructure ------------------------- */

const leaks = /postgresql:\/\/|password|5432|prisma|PrismaClient|at Object\.|node_modules/i;
const errorBodies = [badSort.text, badPage.text, badLimit.text, unknown.text];
const leaking = errorBodies.filter((b) => leaks.test(b));
check(
  "20. error responses expose no connection or stack detail",
  leaking.length === 0,
  leaking[0]?.slice(0, 120)
);

/* ---- 21-23. no request path reads the catalogue file ------------------- */

/**
 * Source with comments removed.
 *
 * Without this, a comment saying "this must never read catalog.json" would
 * itself fail the check that nothing reads catalog.json.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

/**
 * Follows the imports that survive compilation, from an entry file.
 *
 * `import type { X } from "y"` is erased by TypeScript and creates no runtime
 * dependency, so it is deliberately not followed - otherwise this reports edges
 * that do not exist in the built output. Value imports, re-exports and dynamic
 * imports are all followed.
 */
function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];

  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);

    const source = stripComments(fs.readFileSync(file, "utf8"));
    const specs = [];

    // Static imports and re-exports, skipping type-only ones.
    for (const m of source.matchAll(/\b(import|export)\s+([^;'"]*?)\bfrom\s*["']([^"']+)["']/g)) {
      const clause = m[2];
      if (/^\s*type\b/.test(clause)) continue; // erased at compile time
      specs.push(m[3]);
    }
    // Side-effect imports, dynamic imports and require().
    for (const m of source.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      specs.push(m[1]);
    }
    for (const m of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
      specs.push(m[1]);
    }

    for (const spec of specs) {
      let base;
      if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
      else if (spec.startsWith(".")) base = path.resolve(path.dirname(file), spec);
      else continue; // a package, not our source

      const candidate = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(
        (c) => fs.existsSync(c) && fs.statSync(c).isFile()
      );
      if (candidate) queue.push(candidate);
    }
  }
  return seen;
}

const apiEntries = [
  path.join(ROOT, "app/api/products/route.ts"),
  path.join(ROOT, "app/api/products/[id]/route.ts"),
  path.join(ROOT, "app/api/health/route.ts"),
];
const apiGraph = [...new Set(apiEntries.flatMap((e) => [...reachableFrom(e)]))];

const readsCatalogFile = apiGraph.filter((f) =>
  /catalog\.json/.test(stripComments(fs.readFileSync(f, "utf8")))
);
check(
  "21. the API never reads data/catalog.json at runtime",
  readsCatalogFile.length === 0,
  readsCatalogFile.map((f) => path.relative(ROOT, f)).join(", ")
);

const readsCatalogLib = apiGraph.filter((f) => path.resolve(f) === path.join(ROOT, "lib", "catalog.ts"));
check(
  "22. the API never imports lib/catalog.ts at runtime",
  readsCatalogLib.length === 0,
  readsCatalogLib.map((f) => path.relative(ROOT, f)).join(", ")
);

check(
  "23. the API does reach the database layer",
  apiGraph.some((f) => path.resolve(f) === path.join(ROOT, "lib", "db.ts")),
  apiGraph.map((f) => path.relative(ROOT, f)).join(", ")
);

/* ---- 24-25. the same claim, checked against the built output ----------- */

/*
  Checks 21-23 read source. This pair reads the build, which is what actually
  runs - it catches anything the source analysis is wrong about.

  It finds the compiled chunks that physically contain catalogue text, then asks
  which routes load them. A result of "no hits" is only meaningful if the
  matcher would have found a hit had there been one, so the control proves the
  matcher works rather than naming a route.

  The control has had to move twice, which is the check doing its job. It was
  /api/suggest until wave 6B put suggestions on the database; then /cart, until
  wave 6C removed the last runtime caller of getCartIndex() and the catalogue
  stopped being bundled into any server chunk at all. Both times the control
  failed loudly instead of passing against nothing.
*/
const serverDir = path.join(ROOT, ".next", "server");

if (!fs.existsSync(serverDir)) {
  check("24. catalogue data is absent from the built API routes", false, "no build found - run npm run build");
  check("25. the bundle probe can detect catalogue data at all", false, "no build found");
} else {
  const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
  const marker = catalogue.products[0].bullets[0].slice(0, 40);

  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : full.endsWith(".js") ? [full] : [];
    });

  const catalogueChunks = walk(path.join(serverDir, "chunks"))
    .filter((f) => fs.readFileSync(f, "utf8").includes(marker))
    .map((f) => path.basename(f));

  /** Which of those chunks a route's compiled output pulls in. */
  const chunksLoadedBy = (route) => {
    const dir = path.join(serverDir, "app", route);
    if (!fs.existsSync(dir)) return [];
    const text = walk(dir).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    return catalogueChunks.filter((c) => text.includes(c));
  };

  const offenders = ["api/products", "api/health"].flatMap((r) =>
    chunksLoadedBy(r).map((c) => `${r} -> ${c}`)
  );
  check(
    "24. the built API routes load no chunk containing catalogue data",
    offenders.length === 0,
    offenders.join(", ")
  );

  /*
    The control. The marker is read out of data/catalog.json, so it must be
    findable in that file by the same containment test the scan uses. If this
    fails, the marker is wrong or the file moved, and check 24's silence means
    nothing.
  */
  const catalogueText = fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8");
  check(
    "25. the bundle probe can detect catalogue data at all (control: the source file)",
    marker.length > 20 && catalogueText.includes(marker),
    `marker ${JSON.stringify(marker.slice(0, 30))}`
  );

  /*
    Recorded rather than asserted: as of wave 6C nothing bundles the catalogue,
    so the set is empty. It is printed when it is not, because a chunk
    reappearing is worth seeing even where no route loads it.
  */
  if (catalogueChunks.length > 0) {
    console.log(`  note: catalogue text present in ${catalogueChunks.length} server chunk(s)`);
  }
}

/* ---- 26-29. the proof: change the database, watch the API change ------- */

for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const probeId = first.id;
const original = await prisma.product.findUnique({ where: { id: probeId } });
const marker = `QA PROBE ${Date.now()}`;

try {
  check("26. the probe product exists as a database row", original !== null, probeId);

  await prisma.product.update({ where: { id: probeId }, data: { title: marker } });

  const after = await get(`/api/products/${probeId}`);
  check(
    "27. a change made in PostgreSQL appears in the API response",
    after.json?.product?.title === marker,
    `${after.json?.product?.title}`
  );

  const afterList = await get(`/api/products?q=${encodeURIComponent("QA PROBE")}&limit=5`);
  check(
    "28. the same change is visible through the collection route",
    Boolean(afterList.json?.products?.some((p) => p.title === marker)),
    `${afterList.json?.products?.length} rows`
  );
} finally {
  if (original) {
    await prisma.product.update({ where: { id: probeId }, data: { title: original.title } });
  }
  await prisma.$disconnect();
}

const restored = await get(`/api/products/${probeId}`);
check(
  "29. the probe row is restored",
  restored.json?.product?.title === original?.title,
  `${restored.json?.product?.title}`
);

/* ---- 30-31. the diagnostics page renders from the database ------------- */

const diagnostics = await fetch(`${BASE}/diagnostics`);
const html = await diagnostics.text();
check("30. /diagnostics renders", diagnostics.status === 200, `${diagnostics.status}`);
check(
  "31. it reports the row counts it found",
  html.includes("Row counts") && html.includes(">120<"),
  html.includes("Database unavailable") ? "rendered the failure state" : ""
);

fs.writeFileSync(path.join(OUT, "backend-health.json"), JSON.stringify(health.json, null, 2) + "\n");

console.log(`\n${total - problems.length}/${total} backend checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
