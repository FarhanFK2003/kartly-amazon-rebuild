import Fuse from "fuse.js";
import { getAllProducts } from "./catalog";
import type { Product } from "./types";

export type SortKey = "featured" | "price-asc" | "price-desc" | "rating" | "newest";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Avg. Customer Review" },
  { value: "newest", label: "Newest Arrivals" },
];

export interface SearchParamsShape {
  q?: string;
  i?: string;
  rating?: string;
  min?: string;
  max?: string;
  deals?: string;
  sort?: string;
  page?: string;
}

export const PAGE_SIZE = 16;

/**
 * Built once per process over the static catalog. Fuzzy matching is what makes
 * "labtop" or "head phones" still find something, which is the difference
 * between a search box that feels real and one that punishes typos.
 */
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

export interface SearchResult {
  items: Product[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
  sort: SortKey;
  /** True when no query was given, i.e. the shopper is browsing not searching. */
  browsing: boolean;
}

export function searchCatalog(params: SearchParamsShape): SearchResult {
  const query = (params.q ?? "").trim();
  // "all" arrives from the department select when the form posts without JS.
  const department = params.i && params.i !== "all" ? params.i : "";
  const minRating = Number(params.rating ?? 0);
  const min = Number(params.min ?? 0);
  const max = Number(params.max ?? 0);
  const dealsOnly = params.deals === "1";
  const sort = (SORT_OPTIONS.find((s) => s.value === params.sort)?.value ?? "featured") as SortKey;

  let items: Product[] = query
    ? fuse.search(query).map((r) => r.item)
    : getAllProducts();

  if (department) items = items.filter((p) => p.categoryId === department);
  if (minRating > 0) items = items.filter((p) => p.rating >= minRating);
  if (min > 0) items = items.filter((p) => p.price >= min * 100);
  if (max > 0) items = items.filter((p) => p.price <= max * 100);
  if (dealsOnly) items = items.filter((p) => p.dealPercent > 0);

  items = sortProducts(items, sort, Boolean(query));

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page ?? 1) || 1), pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return {
    items: items.slice(start, start + PAGE_SIZE),
    total,
    page,
    pageCount,
    query,
    sort,
    browsing: query.length === 0,
  };
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
    case "featured":
    default:
      // With a query, Fuse has already ordered by relevance and we leave it be.
      // Browsing has no relevance signal, so fall back to social proof.
      return relevanceOrdered ? copy : copy.sort((a, b) => b.reviewCount - a.reviewCount);
  }
}

/** Price brackets for the filter rail, in dollars. */
export const PRICE_BRACKETS = [
  { label: "Up to $25", min: 0, max: 25 },
  { label: "$25 to $50", min: 25, max: 50 },
  { label: "$50 to $100", min: 50, max: 100 },
  { label: "$100 to $250", min: 100, max: 250 },
  { label: "$250 & above", min: 250, max: 0 },
];

/**
 * Rebuilds the querystring with one value changed, preserving everything else.
 * Filters are plain links rather than form controls so that every filtered view
 * has a real, shareable URL and the back button behaves.
 */
export function buildSearchHref(
  current: SearchParamsShape,
  patch: Partial<Record<keyof SearchParamsShape, string | number | null>>
) {
  const next = new URLSearchParams();
  const merged: Record<string, string | number | null | undefined> = { ...current, ...patch };
  // Any filter change resets to the first page.
  if (!("page" in patch)) merged.page = null;

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === "" || value === "all") continue;
    if (key === "page" && String(value) === "1") continue;
    next.set(key, String(value));
  }
  const qs = next.toString();
  return `/s${qs ? `?${qs}` : ""}`;
}
