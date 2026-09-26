import type { Prisma } from "@prisma/client";
import type { SortKey } from "@/lib/search";
import { ClientError } from "./errors";

/*
  The product API's query and response shape.

  Shared by the collection and single-product routes so the two cannot describe
  a product differently.

  Note the `import type` above. This module needs the same sort vocabulary the
  search URL contract uses, but lib/search.ts imports lib/catalog.ts, which
  imports data/catalog.json - so importing a *value* from it would pull the
  entire 120-product catalogue into every API route's bundle, which is exactly
  what this stage exists to stop. A type-only import is erased at compile time
  and leaves no runtime edge, so the sort values are restated below and held to
  lib/search.ts by a compile-time check instead.
*/

/** The accepted `sort` values. Held to lib/search.ts by SortKeysMatch below. */
const SORT_VALUES = ["featured", "price-asc", "price-desc", "rating", "newest"] as const;

type Assert<T extends true> = T;

/**
 * Fails `npm run typecheck` if lib/search.ts ever adds, drops or renames a sort
 * key. lib/search.ts is the authority; this is how the restated list stays
 * honest without importing a value from it.
 */
export type SortKeysMatch = Assert<
  [(typeof SORT_VALUES)[number]] extends [SortKey]
    ? [SortKey] extends [(typeof SORT_VALUES)[number]]
      ? true
      : false
    : false
>;

/** Everything the API needs from the database, in one place. */
export const productInclude = {
  category: { select: { id: true, slug: true, name: true } },
  brand: { select: { id: true, name: true } },
  variants: { orderBy: { position: "asc" } },
  reviews: { orderBy: { helpful: "desc" } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface ProductDto {
  id: string;
  slug: string;
  title: string;
  brand: string;
  categoryId: string;
  category: { id: string; slug: string; name: string };
  price: number;
  listPrice: number | null;
  dealPercent: number;
  rating: number;
  reviewCount: number;
  ratingHistogram: unknown;
  image: string | null;
  bullets: string[];
  specs: unknown;
  stock: number;
  isPrime: boolean;
  deliveryDays: number;
  boughtLastMonth: number;
  badges: string[];
  variants: {
    id: string;
    type: string;
    label: string;
    swatch: string | null;
    priceDelta: number;
  }[];
  reviews: {
    id: string;
    author: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    verified: boolean;
    helpful: number;
  }[];
}

/**
 * Database row to wire format.
 *
 * Dates become the plain YYYY-MM-DD strings the catalogue used, so a consumer
 * reading the API sees the same shape a consumer reading the JSON did. That is
 * what lets wave 6B swap the source without touching the components.
 */
export function toProductDto(p: ProductRow): ProductDto {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand.name,
    categoryId: p.categoryId,
    category: p.category,
    price: p.price,
    listPrice: p.listPrice,
    dealPercent: p.dealPercent,
    rating: p.rating,
    reviewCount: p.reviewCount,
    ratingHistogram: p.ratingHistogram,
    image: p.image,
    bullets: p.bullets,
    specs: p.specs,
    stock: p.stock,
    isPrime: p.isPrime,
    deliveryDays: p.deliveryDays,
    boughtLastMonth: p.boughtLastMonth,
    badges: p.badges,
    variants: p.variants.map((v) => ({
      id: v.id,
      type: v.type,
      label: v.label,
      swatch: v.swatch,
      priceDelta: v.priceDelta,
    })),
    reviews: p.reviews.map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      title: r.title,
      body: r.body,
      date: r.date.toISOString().slice(0, 10),
      verified: r.verified,
      helpful: r.helpful,
    })),
  };
}

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 16;

export interface ParsedQuery {
  q: string;
  category: string | null;
  brand: string | null;
  sort: SortKey;
  page: number;
  limit: number;
}

/**
 * Parses and validates the querystring.
 *
 * Throws on anything malformed rather than silently coercing it: a request for
 * page "abc" is a mistake worth reporting, and quietly serving page 1 hides it.
 */
export function parseQuery(url: URL): ParsedQuery {
  const num = (name: string, fallback: number, min: number, max: number) => {
    const raw = url.searchParams.get(name);
    if (raw === null || raw === "") return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new ClientError(`"${name}" must be an integer between ${min} and ${max}`);
    }
    return n;
  };

  const sortRaw = url.searchParams.get("sort");
  if (sortRaw && !SORT_VALUES.some((v) => v === sortRaw)) {
    throw new ClientError(`"sort" must be one of: ${SORT_VALUES.join(", ")}`);
  }

  return {
    q: (url.searchParams.get("q") ?? "").trim().slice(0, 100),
    category: url.searchParams.get("category"),
    brand: url.searchParams.get("brand"),
    sort: (sortRaw as SortKey) ?? "featured",
    page: num("page", 1, 1, 10_000),
    limit: num("limit", DEFAULT_LIMIT, 1, MAX_LIMIT),
  };
}

/** The Prisma where clause for a parsed query. */
export function buildWhere(query: ParsedQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (query.category) where.categoryId = query.category;
  if (query.brand) where.brand = { name: { equals: query.brand, mode: "insensitive" } };

  if (query.q) {
    // Substring matching in the database. The front end's fuzzy search still
    // runs through Fuse.js in lib/search.ts; see docs/backend.md for why that
    // has not moved yet.
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { brand: { name: { contains: query.q, mode: "insensitive" } } },
      { category: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  return where;
}

/** The Prisma ordering for a sort key, matching the front end's semantics. */
export function buildOrderBy(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ price: "asc" }, { position: "asc" }];
    case "price-desc":
      return [{ price: "desc" }, { position: "asc" }];
    case "rating":
      return [{ rating: "desc" }, { reviewCount: "desc" }, { position: "asc" }];
    case "newest":
      return [{ position: "desc" }];
    default:
      // "featured" is catalogue order, which is what position preserves.
      return [{ position: "asc" }];
  }
}
