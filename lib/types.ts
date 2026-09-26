export type VariantType = "color" | "size" | "style";

export interface Variant {
  id: string;
  type: VariantType;
  label: string;
  swatch: string | null;
  priceDelta: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  helpful: number;
}

export type BadgeKind = "bestSeller" | "choice" | "deal" | "lowStock" | "sponsored";

export interface Product {
  id: string;
  slug: string;
  title: string;
  brand: string;
  categoryId: string;
  /**
   * The department's display name.
   *
   * Optional because it is a join, not a column: the database read layer fills
   * it in so that ProductCard can label a card without looking the category up.
   * That matters because ProductCard is rendered from client components, so it
   * cannot query anything - and resolving the name there was what pulled the
   * whole catalogue into the browser bundle.
   */
  categoryName?: string;
  /** Minor units (cents). Never use floats for money. */
  price: number;
  listPrice: number | null;
  dealPercent: number;
  rating: number;
  reviewCount: number;
  ratingHistogram: Record<"1" | "2" | "3" | "4" | "5", number>;
  image: string | null;
  imageQuery: string;
  bullets: string[];
  specs: Record<string, string>;
  variants: Variant[];
  stock: number;
  isPrime: boolean;
  deliveryDays: number;
  boughtLastMonth: number;
  badges: BadgeKind[];
  reviews: Review[];
}

/**
 * The fields a product card actually renders.
 *
 * ProductCard and Shelf take this rather than a full Product so that surfaces
 * which only show cards - the recently-viewed shelf in particular, which needs
 * the whole catalogue available to join against localStorage ids - do not have
 * to carry reviews, specs, bullets and rating histograms across the server
 * boundary for 120 products. A full Product satisfies it, so every existing
 * caller still compiles.
 */
export type ProductCardData = Pick<
  Product,
  | "id"
  | "slug"
  | "title"
  | "brand"
  | "categoryName"
  | "price"
  | "listPrice"
  | "dealPercent"
  | "rating"
  | "reviewCount"
  | "image"
  | "stock"
  | "deliveryDays"
>;

export interface Category {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  imageQuery: string;
  image: string | null;
}

export interface Catalog {
  generatedAt: string;
  currency: string;
  categories: Category[];
  products: Product[];
}
