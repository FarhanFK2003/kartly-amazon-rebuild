import Fuse from "fuse.js";
import { getAllProducts, getCategories } from "./catalog";
import type { Product } from "./types";

export type SortKey = "featured" | "price-asc" | "price-desc" | "rating" | "newest";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Avg. Customer Review" },
  { value: "newest", label: "Newest Arrivals" },
];

export const PAGE_SIZE = 16;

/** Price buckets, encoded in the URL as "min-max" with an open upper end. */
export const PRICE_BRACKETS = [
  { id: "0-25", label: "Up to $25", min: 0, max: 2500 },
  { id: "25-50", label: "$25 to $50", min: 2500, max: 5000 },
  { id: "50-100", label: "$50 to $100", min: 5000, max: 10000 },
  { id: "100-250", label: "$100 to $250", min: 10000, max: 25000 },
  { id: "250-", label: "$250 & above", min: 25000, max: Infinity },
];

/* ------------------------------------------------------------------ */
/* params                                                              */
/* ------------------------------------------------------------------ */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface Facets {
  q: string;
  categories: string[];
  brands: string[];
  prices: string[];
  /** Minimum average rating, 0 when unset. */
  rating: number;
  inStockOnly: boolean;
  dealsOnly: boolean;
  /** Category-specific spec filters, encoded as "Key:Value". */
  attrs: string[];
  sort: SortKey;
  page: number;
}

const asArray = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];

export function parseFacets(raw: RawSearchParams): Facets {
  const first = (v: string | string[] | undefined) => asArray(v)[0] ?? "";
  // "k" is the legacy alias for the query parameter.
  const q = (first(raw.q) || first(raw.k) || "").trim();

  return {
    q,
    categories: asArray(raw.i).filter((c) => c && c !== "all"),
    brands: asArray(raw.brand),
    prices: asArray(raw.price),
    rating: Number(first(raw.rating)) || 0,
    inStockOnly: first(raw.avail) === "1",
    dealsOnly: first(raw.deals) === "1",
    attrs: asArray(raw.attr),
    sort: (SORT_OPTIONS.find((s) => s.value === first(raw.sort))?.value ?? "featured") as SortKey,
    page: Math.max(1, Number(first(raw.page)) || 1),
  };
}

/** Serialises facets back to a URL, dropping anything at its default. */
export function facetsToHref(f: Facets): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const c of f.categories) p.append("i", c);
  for (const b of f.brands) p.append("brand", b);
  for (const price of f.prices) p.append("price", price);
  for (const a of f.attrs) p.append("attr", a);
  if (f.rating) p.set("rating", String(f.rating));
  if (f.inStockOnly) p.set("avail", "1");
  if (f.dealsOnly) p.set("deals", "1");
  if (f.sort !== "featured") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  const qs = p.toString();
  return `/s${qs ? `?${qs}` : ""}`;
}

/** Adds or removes one value in a multi-select facet, resetting to page 1. */
export function toggleFacet(f: Facets, key: "categories" | "brands" | "prices" | "attrs", value: string): Facets {
  const current = f[key];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...f, [key]: next, page: 1 };
}

export function setFacet<K extends keyof Facets>(f: Facets, key: K, value: Facets[K]): Facets {
  // Sort and page changes should not reset each other, but any filter change does.
  const resetPage = key !== "page";
  return { ...f, [key]: value, page: resetPage ? 1 : (value as number) };
}

export const clearedFacets = (f: Facets): Facets =>
  parseFacets({ q: f.q, sort: f.sort === "featured" ? undefined : f.sort });

export function activeFilterCount(f: Facets): number {
  return (
    f.categories.length +
    f.brands.length +
    f.prices.length +
    f.attrs.length +
    (f.rating ? 1 : 0) +
    (f.inStockOnly ? 1 : 0) +
    (f.dealsOnly ? 1 : 0)
  );
}

/* ------------------------------------------------------------------ */
/* matching                                                            */
/* ------------------------------------------------------------------ */

const fuse = new Fuse(getAllProducts(), {
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

/** Text match only. Fuzzy, so "labtop" still finds laptops. */
function textMatches(q: string): Product[] {
  return q ? fuse.search(q).map((r) => r.item) : getAllProducts();
}

const priceMatches = (p: Product, ids: string[]) =>
  ids.length === 0 ||
  ids.some((id) => {
    const bracket = PRICE_BRACKETS.find((b) => b.id === id);
    return bracket ? p.price >= bracket.min && p.price < bracket.max : true;
  });

const attrMatches = (p: Product, attrs: string[]) => {
  if (attrs.length === 0) return true;
  // Values within one spec key are OR'd; different keys are AND'd, which is what
  // shoppers expect from "16GB or 32GB, and only Meridia".
  const byKey = new Map<string, string[]>();
  for (const a of attrs) {
    const [key, ...rest] = a.split(":");
    const value = rest.join(":");
    byKey.set(key, [...(byKey.get(key) ?? []), value]);
  }
  for (const [key, values] of byKey) {
    if (!values.includes(p.specs[key])) return false;
  }
  return true;
};

type FacetKey = "categories" | "brands" | "prices" | "rating" | "avail" | "deals" | "attrs";

/**
 * Applies every facet except the one named, which is how facet counts are
 * produced: a shopper needs to see how many results *adding* another brand
 * would return, not how many match the brand they already picked.
 */
function applyFacets(products: Product[], f: Facets, except?: FacetKey): Product[] {
  return products.filter((p) => {
    if (except !== "categories" && f.categories.length && !f.categories.includes(p.categoryId)) return false;
    if (except !== "brands" && f.brands.length && !f.brands.includes(p.brand)) return false;
    if (except !== "prices" && !priceMatches(p, f.prices)) return false;
    if (except !== "rating" && f.rating && p.rating < f.rating) return false;
    if (except !== "avail" && f.inStockOnly && p.stock <= 0) return false;
    if (except !== "deals" && f.dealsOnly && p.dealPercent <= 0) return false;
    if (except !== "attrs" && !attrMatches(p, f.attrs)) return false;
    return true;
  });
}

function sortProducts(items: Product[], sort: SortKey, relevanceOrdered: boolean): Product[] {
  const copy = [...items];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    case "newest":
      return copy.sort((a, b) => b.id.localeCompare(a.id));
    default:
      // With a query, Fuse already ordered by relevance. Browsing has no
      // relevance signal, so fall back to social proof.
      return relevanceOrdered ? copy : copy.sort((a, b) => b.reviewCount - a.reviewCount);
  }
}

/* ------------------------------------------------------------------ */
/* facet options                                                       */
/* ------------------------------------------------------------------ */

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}

export interface AttributeFacet {
  key: string;
  options: FacetOption[];
}

export interface FacetModel {
  categories: FacetOption[];
  brands: FacetOption[];
  prices: FacetOption[];
  ratings: FacetOption[];
  availability: FacetOption[];
  deals: FacetOption[];
  attributes: AttributeFacet[];
}

const countBy = <T>(items: Product[], key: (p: Product) => T | null) => {
  const counts = new Map<T, number>();
  for (const p of items) {
    const k = key(p);
    if (k === null) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
};

/**
 * Every count here is computed from the real catalogue, never hard-coded, and
 * never shows an option that would lead to zero results.
 */
function buildFacets(base: Product[], f: Facets): FacetModel {
  const categories = getCategories();

  const catCounts = countBy(applyFacets(base, f, "categories"), (p) => p.categoryId);
  const brandCounts = countBy(applyFacets(base, f, "brands"), (p) => p.brand);
  const priceBase = applyFacets(base, f, "prices");
  const ratingBase = applyFacets(base, f, "rating");
  const availBase = applyFacets(base, f, "avail");
  const dealsBase = applyFacets(base, f, "deals");

  const model: FacetModel = {
    categories: categories
      .map((c) => ({
        value: c.id,
        label: c.name,
        count: catCounts.get(c.id) ?? 0,
        selected: f.categories.includes(c.id),
      }))
      .filter((o) => o.count > 0 || o.selected),

    brands: [...brandCounts.entries()]
      .map(([brand, count]) => ({ value: brand, label: brand, count, selected: f.brands.includes(brand) }))
      .filter((o) => o.count > 0 || o.selected)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),

    prices: PRICE_BRACKETS.map((b) => ({
      value: b.id,
      label: b.label,
      count: priceBase.filter((p) => p.price >= b.min && p.price < b.max).length,
      selected: f.prices.includes(b.id),
    })).filter((o) => o.count > 0 || o.selected),

    ratings: [4, 3, 2, 1].map((stars) => ({
      value: String(stars),
      label: `${stars} & Up`,
      count: ratingBase.filter((p) => p.rating >= stars).length,
      selected: f.rating === stars,
    })).filter((o) => o.count > 0 || o.selected),

    availability: [
      {
        value: "1",
        label: "Include out of stock",
        count: availBase.length,
        selected: !f.inStockOnly,
      },
    ],

    deals: [
      {
        value: "1",
        label: "All discounts",
        count: dealsBase.filter((p) => p.dealPercent > 0).length,
        selected: f.dealsOnly,
      },
    ],

    attributes: buildAttributeFacets(base, f),
  };

  return model;
}

/**
 * Spec-based facets only make sense once a department is chosen - "RAM Size"
 * is meaningless across pet supplies and books. So they appear only when the
 * result set is narrow enough for the keys to be shared.
 */
function buildAttributeFacets(base: Product[], f: Facets): AttributeFacet[] {
  const scoped = applyFacets(base, f, "attrs");
  if (scoped.length === 0 || scoped.length > 40) return [];

  const keyValues = new Map<string, Map<string, number>>();
  for (const p of scoped) {
    for (const [key, value] of Object.entries(p.specs)) {
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
        .map(([value, count]) => ({
          value: `${key}:${value}`,
          label: value,
          count,
          selected: f.attrs.includes(`${key}:${value}`),
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }));
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  items: Product[];
  total: number;
  page: number;
  pageCount: number;
  facets: FacetModel;
  browsing: boolean;
}

export function searchCatalog(f: Facets): SearchResult {
  const base = textMatches(f.q);
  const filtered = applyFacets(base, f);
  const sorted = sortProducts(filtered, f.sort, Boolean(f.q));

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, f.page), pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return {
    items: sorted.slice(start, start + PAGE_SIZE),
    total,
    page,
    pageCount,
    facets: buildFacets(base, f),
    browsing: f.q.length === 0,
  };
}
