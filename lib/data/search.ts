import "server-only";
import { cache } from "react";
import Fuse from "fuse.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Product } from "@/lib/types";
import {
  PAGE_SIZE,
  PRICE_BRACKETS,
  type FacetModel,
  type Facets,
  type FacetOption,
  type SortKey,
} from "@/lib/search-params";
import { getCategories, getProductsByIds } from "./products";

/*
  Search, against PostgreSQL.

  This replaces searchCatalog() in lib/search.ts, which filtered an in-memory
  copy of data/catalog.json. The behaviour it produces is deliberately the
  same - same facets, same counts, same ordering, same page size - because the
  URL contract and the QA suites both depend on it. What changed is where the
  rows come from.

  Where the work happens, and why:

  * Filtering (department, brand, price bracket, rating, availability, offers,
    spec attributes), sorting and pagination are all SQL. Nothing fetches the
    catalogue and slices it.

  * Facet counts are SQL aggregates, issued as one batched round trip. Each
    count deliberately ignores its own dimension: a shopper needs to see how
    many results *adding* another brand would return, not how many match the
    brand already chosen.

  * Text relevance is the one exception, and it is a considered one. The
    existing search is fuzzy - "labtop" finds laptops - and ranks by Fuse's
    relevance score. Postgres cannot reproduce that ranking without pg_trgm and
    a different scoring model, which would silently change which result comes
    first. So when there is a query, a narrow projection (id, title, brand,
    imageQuery, categoryId, bullets - no reviews, no specs, no images) is read
    FROM THE DATABASE and ranked with the identical Fuse configuration. The
    result is an ordered list of ids; every filter, sort and page bound is then
    applied in SQL against that set.

    The source of truth is PostgreSQL either way. A product deleted from the
    database cannot appear in results, and an edited title is matched on its new
    value. This is ranking, not storage.
*/

export interface SearchResult {
  items: Product[];
  total: number;
  page: number;
  pageCount: number;
  facets: FacetModel;
  browsing: boolean;
}

/* ------------------------------------------------------------------ */
/* text matching                                                       */
/* ------------------------------------------------------------------ */

interface SearchDoc {
  id: string;
  title: string;
  brand: string;
  categoryId: string;
  imageQuery: string;
  bullets: string[];
}

/**
 * The searchable projection, read from PostgreSQL.
 *
 * Cached per request, so a page that searches and then counts facets reads it
 * once. It is rebuilt on every request, which is what makes an edit in the
 * database immediately searchable.
 */
const getSearchDocs = cache(async (): Promise<SearchDoc[]> => {
  const rows = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      categoryId: true,
      imageQuery: true,
      bullets: true,
      brand: { select: { name: true } },
    },
    orderBy: { position: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    brand: r.brand.name,
    categoryId: r.categoryId,
    imageQuery: r.imageQuery,
    bullets: r.bullets,
  }));
});

/**
 * Ids matching the query, most relevant first.
 *
 * The Fuse options are identical to the ones lib/search.ts used, so relevance
 * ordering does not shift as part of this migration.
 */
async function rankedIds(q: string): Promise<string[]> {
  const docs = await getSearchDocs();
  const fuse = new Fuse(docs, {
    includeScore: true,
    threshold: 0.38,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: "title", weight: 0.45 },
      { name: "brand", weight: 0.15 },
      { name: "imageQuery", weight: 0.2 },
      { name: "bullets", weight: 0.1 },
      { name: "categoryId", weight: 0.1 },
    ],
  });
  return fuse.search(q).map((r) => r.item.id);
}

/* ------------------------------------------------------------------ */
/* where clauses                                                       */
/* ------------------------------------------------------------------ */

type FacetKey = "categories" | "brands" | "prices" | "rating" | "avail" | "deals" | "attrs";

/** The price-bracket clause for a set of bracket ids. */
function priceClause(ids: string[]): Prisma.ProductWhereInput | null {
  if (ids.length === 0) return null;
  const ranges = ids
    .map((id) => PRICE_BRACKETS.find((b) => b.id === id))
    .filter((b): b is (typeof PRICE_BRACKETS)[number] => Boolean(b));
  if (ranges.length === 0) return null;

  return {
    OR: ranges.map((b) => ({
      price: b.max === Infinity ? { gte: b.min } : { gte: b.min, lt: b.max },
    })),
  };
}

/**
 * Spec filters against the JSON column.
 *
 * Values within one spec key are OR'd and different keys are AND'd, which is
 * what a shopper means by "16GB or 32GB, and only Meridia".
 */
function attrClause(attrs: string[]): Prisma.ProductWhereInput | null {
  if (attrs.length === 0) return null;

  const byKey = new Map<string, string[]>();
  for (const a of attrs) {
    const [key, ...rest] = a.split(":");
    const value = rest.join(":");
    byKey.set(key, [...(byKey.get(key) ?? []), value]);
  }

  return {
    AND: [...byKey.entries()].map(([key, values]) => ({
      OR: values.map((value) => ({ specs: { path: [key], equals: value } })),
    })),
  };
}

/**
 * The SQL filter for a set of facets, optionally ignoring one dimension.
 *
 * `matchedIds` is null when there is no query; otherwise it restricts the set
 * to what the text search matched.
 */
function buildWhere(
  f: Facets,
  matchedIds: string[] | null,
  except?: FacetKey
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (matchedIds !== null) and.push({ id: { in: matchedIds } });
  if (except !== "categories" && f.categories.length) and.push({ categoryId: { in: f.categories } });
  if (except !== "brands" && f.brands.length) and.push({ brand: { name: { in: f.brands } } });
  if (except !== "prices") {
    const clause = priceClause(f.prices);
    if (clause) and.push(clause);
  }
  if (except !== "rating" && f.rating) and.push({ rating: { gte: f.rating } });
  if (except !== "avail" && f.inStockOnly) and.push({ stock: { gt: 0 } });
  if (except !== "deals" && f.dealsOnly) and.push({ dealPercent: { gt: 0 } });
  if (except !== "attrs") {
    const clause = attrClause(f.attrs);
    if (clause) and.push(clause);
  }

  return and.length ? { AND: and } : {};
}

/** SQL ordering. Relevance is handled separately; it is not expressible here. */
function orderFor(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ price: "asc" }];
    case "price-desc":
      return [{ price: "desc" }];
    case "rating":
      return [{ rating: "desc" }, { reviewCount: "desc" }];
    case "newest":
      // lib/search.ts ordered by descending id, which is the catalogue's own
      // arrival order. Kept identical so "Newest Arrivals" does not reshuffle.
      return [{ id: "desc" }];
    default:
      // Browsing has no relevance signal, so featured falls back to social
      // proof - exactly as the static engine did.
      return [{ reviewCount: "desc" }];
  }
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

export async function searchProducts(f: Facets): Promise<SearchResult> {
  const matchedIds = f.q ? await rankedIds(f.q) : null;

  // An empty match set means no results; short-circuit rather than issuing a
  // query with `id IN ()`.
  if (matchedIds !== null && matchedIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
      facets: await buildFacetModel(f, matchedIds),
      browsing: false,
    };
  }

  const where = buildWhere(f, matchedIds);
  const relevanceOrdered = Boolean(f.q) && f.sort === "featured";

  let ids: string[];
  let total: number;
  let page: number;
  let pageCount: number;

  if (relevanceOrdered) {
    // Relevance order cannot be expressed in SQL, so the database decides
    // *which* rows qualify and the ranking decides their order.
    const rows = await prisma.product.findMany({ where, select: { id: true } });
    const qualifying = new Set(rows.map((r) => r.id));
    const ordered = matchedIds!.filter((id) => qualifying.has(id));

    total = ordered.length;
    pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, f.page), pageCount);
    ids = ordered.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);
  } else {
    total = await prisma.product.count({ where });
    pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, f.page), pageCount);

    const rows = await prisma.product.findMany({
      where,
      select: { id: true },
      orderBy: orderFor(f.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    ids = rows.map((r) => r.id);
  }

  const [items, facets] = await Promise.all([
    getProductsByIds(ids),
    buildFacetModel(f, matchedIds),
  ]);

  return { items, total, page, pageCount, facets, browsing: f.q.length === 0 };
}

/* ------------------------------------------------------------------ */
/* facet counts                                                        */
/* ------------------------------------------------------------------ */

/**
 * Counts for every facet option, computed in the database.
 *
 * Issued as one batched transaction rather than eight sequential awaits; with
 * the database in Singapore that is the difference between one round trip and
 * eight.
 */
async function buildFacetModel(f: Facets, matchedIds: string[] | null): Promise<FacetModel> {
  const empty = matchedIds !== null && matchedIds.length === 0;

  if (empty) {
    return {
      categories: [],
      brands: [],
      prices: [],
      ratings: [],
      availability: [{ value: "1", label: "Include out of stock", count: 0, selected: !f.inStockOnly }],
      deals: [{ value: "1", label: "All discounts", count: 0, selected: f.dealsOnly }],
      attributes: [],
    };
  }

  const [categories, catGroups, brandGroups, priceRows, ratingRows, availCount, dealsCount, attrRows] =
    await Promise.all([
      getCategories(),
      prisma.product.groupBy({
        by: ["categoryId"],
        where: buildWhere(f, matchedIds, "categories"),
        _count: { _all: true },
      }),
      prisma.product.groupBy({
        by: ["brandId"],
        where: buildWhere(f, matchedIds, "brands"),
        _count: { _all: true },
      }),
      // Bracket boundaries overlap awkwardly in SQL; one narrow projection of
      // prices is cheaper and simpler than five counting queries.
      prisma.product.findMany({
        where: buildWhere(f, matchedIds, "prices"),
        select: { price: true },
      }),
      prisma.product.findMany({
        where: buildWhere(f, matchedIds, "rating"),
        select: { rating: true },
      }),
      prisma.product.count({ where: buildWhere(f, matchedIds, "avail") }),
      prisma.product.count({
        where: { AND: [buildWhere(f, matchedIds, "deals"), { dealPercent: { gt: 0 } }] },
      }),
      // Spec facets are only shown for a narrow result set, so this reads specs
      // for at most a few dozen rows.
      prisma.product.findMany({
        where: buildWhere(f, matchedIds, "attrs"),
        select: { specs: true },
        take: 41,
      }),
    ]);

  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandName = new Map(brands.map((b) => [b.id, b.name]));

  const catCount = new Map(catGroups.map((g) => [g.categoryId, g._count._all]));

  return {
    categories: categories
      .map((c) => ({
        value: c.id,
        label: c.name,
        count: catCount.get(c.id) ?? 0,
        selected: f.categories.includes(c.id),
      }))
      .filter((o) => o.count > 0 || o.selected),

    brands: brandGroups
      .map((g) => {
        const name = brandName.get(g.brandId) ?? g.brandId;
        return {
          value: name,
          label: name,
          count: g._count._all,
          selected: f.brands.includes(name),
        };
      })
      .filter((o) => o.count > 0 || o.selected)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),

    prices: PRICE_BRACKETS.map((b) => ({
      value: b.id,
      label: b.label,
      count: priceRows.filter((p) => p.price >= b.min && p.price < b.max).length,
      selected: f.prices.includes(b.id),
    })).filter((o) => o.count > 0 || o.selected),

    ratings: [4, 3, 2, 1]
      .map((stars) => ({
        value: String(stars),
        label: `${stars} & Up`,
        count: ratingRows.filter((p) => p.rating >= stars).length,
        selected: f.rating === stars,
      }))
      .filter((o) => o.count > 0 || o.selected),

    availability: [
      { value: "1", label: "Include out of stock", count: availCount, selected: !f.inStockOnly },
    ],

    deals: [{ value: "1", label: "All discounts", count: dealsCount, selected: f.dealsOnly }],

    attributes: buildAttributeFacets(
      attrRows.map((r) => r.specs as Record<string, string>),
      f
    ),
  };
}

/**
 * Spec-based facets only make sense once a department is chosen - "RAM Size"
 * is meaningless across pet supplies and books. So they appear only when the
 * result set is narrow enough for the keys to be shared.
 */
function buildAttributeFacets(
  specsList: Record<string, string>[],
  f: Facets
): FacetModel["attributes"] {
  if (specsList.length === 0 || specsList.length > 40) return [];

  const keyValues = new Map<string, Map<string, number>>();
  for (const specs of specsList) {
    for (const [key, value] of Object.entries(specs)) {
      // Brand is already its own facet; identity-like keys make poor facets.
      if (key === "Brand" || key === "Publisher" || !value) continue;
      if (!keyValues.has(key)) keyValues.set(key, new Map());
      const values = keyValues.get(key)!;
      values.set(value, (values.get(value) ?? 0) + 1);
    }
  }

  return [...keyValues.entries()]
    // A useful facet splits the results: at least two values, and not one per product.
    .filter(([, values]) => values.size >= 2 && values.size <= 8)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 3)
    .map(([key, values]) => ({
      key,
      options: [...values.entries()]
        .map(
          (entry): FacetOption => ({
            value: `${key}:${entry[0]}`,
            label: entry[0],
            count: entry[1],
            selected: f.attrs.includes(`${key}:${entry[0]}`),
          })
        )
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }));
}
