import type * as Legacy from "@/lib/search";

/*
  The search URL contract.

  Every one of these functions is pure: it turns a querystring into facets, or
  facets back into a URL. None of them touch product data.

  They used to live in lib/search.ts alongside the matching engine, and that
  coupling had a real cost. lib/search.ts builds a Fuse index over the whole
  catalogue at module scope, so any module importing even `facetsToHref` from
  it pulled in all 120 products - and since the filter sheet and sort control
  are client components, that shipped a 318 KB catalogue chunk to the browser
  on every visit.

  lib/search.ts is a protected file, so it is left exactly as it was. This
  module is the live URL contract; the definitions are restated here rather
  than re-exported so that nothing has to import the static engine. The type
  assertions at the bottom stop the two drifting apart silently.

  The contract itself is unchanged and must stay that way: q, i, brand, price,
  rating, deals, avail, attr, sort, page, and the legacy k alias for q.
*/

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
export function toggleFacet(
  f: Facets,
  key: "categories" | "brands" | "prices" | "attrs",
  value: string
): Facets {
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
/* facet model                                                         */
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

/* ------------------------------------------------------------------ */
/* drift guard                                                         */
/* ------------------------------------------------------------------ */

/*
  These are type-only imports and assertions, erased at compile time, so they
  add no runtime dependency on the static engine. They exist so that if
  lib/search.ts and this module ever disagree about the shape of the URL
  contract, `npm run typecheck` says so instead of the two quietly diverging.
*/

type Assert<T extends true> = T;
type Identical<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export type SortKeyMatchesLegacy = Assert<Identical<SortKey, Legacy.SortKey>>;
export type FacetsMatchLegacy = Assert<Identical<Facets, Legacy.Facets>>;
export type FacetModelMatchesLegacy = Assert<Identical<FacetModel, Legacy.FacetModel>>;
export type FacetOptionMatchesLegacy = Assert<Identical<FacetOption, Legacy.FacetOption>>;
export type RawParamsMatchLegacy = Assert<Identical<RawSearchParams, Legacy.RawSearchParams>>;
