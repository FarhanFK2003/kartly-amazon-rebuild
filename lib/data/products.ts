import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  BadgeKind,
  Category,
  Product,
  ProductCardData,
  Review,
  Variant,
} from "@/lib/types";

/*
  The storefront's product read layer.

  This is the database-backed replacement for lib/catalog.ts. It returns the
  same Product and Category shapes from lib/types.ts, so the migration is a
  change of source rather than a rewrite of every component.

  Three rules it holds to:

  * It never imports data/catalog.json or lib/catalog.ts, and it has no static
    fallback. If PostgreSQL is unreachable the error propagates and the route
    fails loudly. A storefront that quietly serves stale fixtures when its
    database is down is worse than one that returns an error, because nobody
    finds out.

  * It is server-only. The `server-only` import above turns any attempt to pull
    this into a client bundle into a build error, which is what keeps the
    catalogue - and the database credentials - out of the browser.

  * Every entry point is wrapped in React's cache(), so a page that needs the
    category list in the header, in a product card and in a breadcrumb issues
    one query per request rather than three. This matters more than usual here:
    the database is in Singapore, so each round trip is real latency.
*/

/** Everything needed to build a full Product. */
const productInclude = {
  brand: { select: { name: true } },
  category: { select: { id: true, name: true } },
  variants: { orderBy: { position: "asc" } },
  reviews: { orderBy: { helpful: "desc" } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * A database row as the UI's Product.
 *
 * The field order and types mirror lib/types.ts deliberately - if the two ever
 * drift, this function is the one place to look.
 */
function toProduct(p: ProductRow): Product {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand.name,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    price: p.price,
    listPrice: p.listPrice,
    dealPercent: p.dealPercent,
    rating: p.rating,
    reviewCount: p.reviewCount,
    ratingHistogram: p.ratingHistogram as Product["ratingHistogram"],
    image: p.image,
    imageQuery: p.imageQuery,
    bullets: p.bullets,
    specs: p.specs as Record<string, string>,
    variants: p.variants.map(
      (v): Variant => ({
        id: v.id,
        type: v.type as Variant["type"],
        label: v.label,
        swatch: v.swatch,
        priceDelta: v.priceDelta,
      })
    ),
    stock: p.stock,
    isPrime: p.isPrime,
    deliveryDays: p.deliveryDays,
    boughtLastMonth: p.boughtLastMonth,
    badges: p.badges as BadgeKind[],
    reviews: p.reviews.map(
      (r): Review => ({
        id: r.id,
        author: r.author,
        rating: r.rating,
        title: r.title,
        body: r.body,
        // The catalogue used plain YYYY-MM-DD strings and the UI formats them
        // as such; the column is a DATE, so this is a straight conversion.
        date: r.date.toISOString().slice(0, 10),
        verified: r.verified,
        helpful: r.helpful,
      })
    ),
  };
}

/* ------------------------------------------------------------------ */
/* categories                                                          */
/* ------------------------------------------------------------------ */

/**
 * Departments, each carrying its product count and its cover image.
 *
 * lib/catalog.ts derived the cover by scanning every product for the
 * most-reviewed one in the department. That is a sort over the whole catalogue
 * per category; here it is a single grouped query plus one lookup, because the
 * database can rank rows far more cheaply than we can.
 */
export const getCategories = cache(async (): Promise<Category[]> => {
  /*
    Promise.all, not $transaction.

    These two reads have no consistency requirement between them, and Prisma's
    array form still opens a real transaction with a five second ceiling. Under
    load, against a database this far away, that ceiling is reachable - and when
    it is reached the page 500s. Concurrency was the only thing wanted here.
  */
  const [rows, covers] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    // The most-reviewed product of each department, as its cover. Fetching a
    // narrow projection of all products and picking per category costs one
    // round trip; a correlated per-category query would cost ten.
    prisma.product.findMany({
      select: { categoryId: true, image: true, reviewCount: true },
      orderBy: { reviewCount: "desc" },
    }),
  ]);

  const coverFor = new Map<string, string | null>();
  for (const p of covers) {
    if (!coverFor.has(p.categoryId)) coverFor.set(p.categoryId, p.image);
  }

  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    blurb: c.blurb,
    imageQuery: c.imageQuery,
    image: coverFor.get(c.id) ?? null,
  }));
});

export const getCategory = cache(async (id: string): Promise<Category | undefined> => {
  const all = await getCategories();
  return all.find((c) => c.id === id);
});

/** Category id to display name. Used by components that only need a label. */
export const getCategoryNames = cache(async (): Promise<Record<string, string>> => {
  const rows = await prisma.category.findMany({ select: { id: true, name: true } });
  return Object.fromEntries(rows.map((c) => [c.id, c.name]));
});

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

export const getAllProducts = cache(async (): Promise<Product[]> => {
  const rows = await prisma.product.findMany({
    include: productInclude,
    orderBy: { position: "asc" },
  });
  return rows.map(toProduct);
});

/**
 * One product by catalogue id or slug.
 *
 * /dp/[id] links use the descriptive slug, which itself ends in the id, and
 * short ids remain valid permalinks - so both have to resolve, exactly as
 * lib/catalog.ts did.
 */
export const getProductByIdOrSlug = cache(async (key: string): Promise<Product | undefined> => {
  const decoded = decodeURIComponent(key);
  const row = await prisma.product.findFirst({
    where: { OR: [{ slug: decoded }, { id: decoded }] },
    include: productInclude,
  });
  return row ? toProduct(row) : undefined;
});

/**
 * Products for a list of ids, returned in the order the ids were given.
 *
 * SQL has no opinion about the order of an `IN` list, and search results are
 * already ranked by the time they get here, so the caller's order wins.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: productInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, toProduct(r)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export const getProductsByCategory = cache(async (categoryId: string): Promise<Product[]> => {
  const rows = await prisma.product.findMany({
    where: { categoryId },
    include: productInclude,
    orderBy: { position: "asc" },
  });
  return rows.map(toProduct);
});

/** Products carrying a given badge, strongest social proof first. */
export const getProductsWithBadge = cache(
  async (badge: BadgeKind, limit = 12): Promise<Product[]> => {
    const rows = await prisma.product.findMany({
      where: { badges: { has: badge as never } },
      include: productInclude,
      orderBy: { reviewCount: "desc" },
      take: limit,
    });
    return rows.map(toProduct);
  }
);

export const getBestSellers = cache(async (limit = 12): Promise<Product[]> => {
  const rows = await prisma.product.findMany({
    include: productInclude,
    orderBy: { reviewCount: "desc" },
    take: limit,
  });
  return rows.map(toProduct);
});

export const getDeals = cache(async (limit = 12): Promise<Product[]> => {
  const rows = await prisma.product.findMany({
    where: { dealPercent: { gt: 0 } },
    include: productInclude,
    orderBy: { dealPercent: "desc" },
    take: limit,
  });
  return rows.map(toProduct);
});

/**
 * Top rated, restricted to products with enough reviews for the rating to mean
 * anything - a 5.0 from nine people is not a recommendation.
 *
 * The threshold was applied in the homepage component before; it belongs here,
 * where the query can use it, rather than fetching everything and discarding
 * most of it.
 */
export const getTopRated = cache(
  async (limit = 12, minReviews = 500): Promise<Product[]> => {
    const rows = await prisma.product.findMany({
      where: { reviewCount: { gte: minReviews } },
      include: productInclude,
      orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
      take: limit,
    });
    return rows.map(toProduct);
  }
);

/**
 * Same department first, then anything else - matching lib/catalog.ts.
 *
 * Deliberately two bounded queries rather than one unbounded one. Reading the
 * whole catalogue with its reviews and variants attached and then slicing ten
 * rows off the front cost seconds per product page; asking for only the rows
 * that can actually be returned costs one round trip and a small result set.
 */
export const getRelatedProducts = cache(
  async (product: Pick<Product, "id" | "categoryId">, limit = 10): Promise<Product[]> => {
    const sameCategory = await prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: product.id } },
      include: productInclude,
      orderBy: { position: "asc" },
      take: limit,
    });

    if (sameCategory.length >= limit) return sameCategory.map(toProduct);

    // Not enough in the department to fill the shelf, so top up from the rest
    // of the catalogue - the static implementation did the same.
    const others = await prisma.product.findMany({
      where: { categoryId: { not: product.categoryId }, id: { not: product.id } },
      include: productInclude,
      orderBy: { position: "asc" },
      take: limit - sameCategory.length,
    });

    return [...sameCategory, ...others].map(toProduct);
  }
);

/**
 * Every product, projected down to what a card renders.
 *
 * The recently-viewed shelf joins localStorage ids against the whole catalogue
 * on the client, so the whole catalogue has to cross the server boundary. This
 * keeps that payload to the thirteen fields a card uses instead of sending
 * reviews, specs, bullets and rating histograms for 120 products.
 */
export const getCardProducts = cache(async (): Promise<ProductCardData[]> => {
  const rows = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      listPrice: true,
      dealPercent: true,
      rating: true,
      reviewCount: true,
      image: true,
      stock: true,
      deliveryDays: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { position: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    brand: r.brand.name,
    categoryName: r.category.name,
    price: r.price,
    listPrice: r.listPrice,
    dealPercent: r.dealPercent,
    rating: r.rating,
    reviewCount: r.reviewCount,
    image: r.image,
    stock: r.stock,
    deliveryDays: r.deliveryDays,
  }));
});

/**
 * In-stock products that could belong in a frequently-bought-together bundle.
 *
 * One query covering both cases lib/bundles.ts considers: a product whose
 * search term is one of the wanted complements, or any product from the
 * anchor's own department for the fallback. Catalogue order is preserved so
 * the chosen bundle is stable between requests.
 */
export async function getBundleCandidates(
  terms: string[],
  categoryId: string,
  excludeId: string
): Promise<Product[]> {
  const or: Prisma.ProductWhereInput[] = [{ categoryId }];
  if (terms.length > 0) or.push({ imageQuery: { in: terms } });

  const rows = await prisma.product.findMany({
    where: { AND: [{ id: { not: excludeId } }, { stock: { gt: 0 } }, { OR: or }] },
    include: productInclude,
    orderBy: { position: "asc" },
  });
  return rows.map(toProduct);
}

/** The best-reviewed product of one department, or undefined if it is empty. */
export const getTopProductOfDepartment = cache(
  async (categoryId: string): Promise<Product | undefined> => {
    const row = await prisma.product.findFirst({
      where: { categoryId },
      include: productInclude,
      orderBy: { reviewCount: "desc" },
    });
    return row ? toProduct(row) : undefined;
  }
);

export const getBrands = cache(async (): Promise<string[]> => {
  const rows = await prisma.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  return rows.map((b) => b.name);
});

export const priceRange = cache(async (): Promise<{ min: number; max: number }> => {
  const result = await prisma.product.aggregate({ _min: { price: true }, _max: { price: true } });
  return { min: result._min.price ?? 0, max: result._max.price ?? 0 };
});

/* ------------------------------------------------------------------ */
/* department statistics                                               */
/* ------------------------------------------------------------------ */

export interface DepartmentStat {
  id: string;
  name: string;
  blurb: string;
  image: string | null;
  count: number;
  /** Total reviews across the department - how the homepage ranks them. */
  reviews: number;
  /** Real brands stocked here, most products first. */
  brands: string[];
}

/**
 * Per-department counts, review totals and stocked brands.
 *
 * The homepage, /browse and the navigation drawer all needed the same three
 * numbers and each derived them separately by scanning the catalogue. They are
 * computed once here, in two grouped queries, and shared through cache().
 */
export const getDepartmentStats = cache(async (): Promise<DepartmentStat[]> => {
  const [categories, grouped, brandRows] = await Promise.all([
    getCategories(),
    prisma.product.groupBy({
      by: ["categoryId"],
      _count: { _all: true },
      _sum: { reviewCount: true },
    }),
    prisma.product.groupBy({
      by: ["categoryId", "brandId"],
      _count: { _all: true },
    }),
  ]);

  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandName = new Map(brands.map((b) => [b.id, b.name]));

  const byCategory = new Map(grouped.map((g) => [g.categoryId, g]));

  const brandsFor = new Map<string, { name: string; count: number }[]>();
  for (const row of brandRows) {
    const list = brandsFor.get(row.categoryId) ?? [];
    list.push({ name: brandName.get(row.brandId) ?? row.brandId, count: row._count._all });
    brandsFor.set(row.categoryId, list);
  }

  return categories.map((c) => {
    const stat = byCategory.get(c.id);
    return {
      id: c.id,
      name: c.name,
      blurb: c.blurb,
      image: c.image,
      count: stat?._count._all ?? 0,
      reviews: stat?._sum.reviewCount ?? 0,
      brands: (brandsFor.get(c.id) ?? [])
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 5)
        .map((b) => b.name),
    };
  });
});

export const getProductCount = cache(async (): Promise<number> => prisma.product.count());
