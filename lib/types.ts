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
