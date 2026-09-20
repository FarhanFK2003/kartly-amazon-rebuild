import catalogJson from "@/data/catalog.json";
import type { Catalog, Category, Product } from "./types";

// The catalog is static data compiled into the bundle. There is no database and
// no API round-trip, which keeps every page server-renderable and instant.
const catalog = catalogJson as unknown as Catalog;

export const CURRENCY = catalog.currency;

/**
 * Category tiles show the department's most-reviewed product rather than a
 * separate stock photo.
 *
 * Generic terms like "clothing apparel" return documentary photography from an
 * openly-licensed pool - buildings, street scenes, people - which reads as a
 * photo library rather than a shop, and is not imagery a storefront should be
 * putting in front of shoppers. A real product from the department is always on
 * topic, and it is what marketplaces actually show.
 */
function withRepresentativeImage(category: Category): Category {
  const hero = catalog.products
    .filter((p) => p.categoryId === category.id)
    .sort((a, b) => b.reviewCount - a.reviewCount)[0];
  return { ...category, image: hero?.image ?? category.image };
}

export function getCategories(): Category[] {
  return catalog.categories.map(withRepresentativeImage);
}

export function getCategory(id: string): Category | undefined {
  const found = catalog.categories.find((c) => c.id === id);
  return found ? withRepresentativeImage(found) : undefined;
}

export function getAllProducts(): Product[] {
  return catalog.products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return catalog.products.find((p) => p.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return catalog.products.find((p) => p.id === id);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return catalog.products.filter((p) => p.categoryId === categoryId);
}

/** Products carrying a given badge, strongest social proof first. */
export function getProductsWithBadge(badge: Product["badges"][number], limit = 12): Product[] {
  return catalog.products
    .filter((p) => p.badges.includes(badge))
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, limit);
}

export function getBestSellers(limit = 12): Product[] {
  return [...catalog.products].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, limit);
}

export function getDeals(limit = 12): Product[] {
  return catalog.products
    .filter((p) => p.dealPercent > 0)
    .sort((a, b) => b.dealPercent - a.dealPercent)
    .slice(0, limit);
}

/** Cheap similarity: same category, excluding the product itself. */
export function getRelatedProducts(product: Product, limit = 10): Product[] {
  const sameCategory = catalog.products.filter(
    (p) => p.categoryId === product.categoryId && p.id !== product.id
  );
  const others = catalog.products.filter((p) => p.categoryId !== product.categoryId);
  return [...sameCategory, ...others].slice(0, limit);
}

export function priceRange(): { min: number; max: number } {
  const prices = catalog.products.map((p) => p.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function getBrands(): string[] {
  return [...new Set(catalog.products.map((p) => p.brand))].sort();
}
