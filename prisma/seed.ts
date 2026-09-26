import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type Badge, type VariantType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/*
  Seeds PostgreSQL from data/catalog.json.

  The catalogue is the seed source, not the runtime store: this script is the
  one place the JSON is read, and nothing in the request path imports it.

  It transforms the file programmatically rather than restating 120 products in
  TypeScript, and every write is an upsert keyed on the catalogue id, so running
  it twice produces the same database rather than a second copy. Variants and
  reviews belonging to a product are replaced wholesale on each run, which keeps
  the seed authoritative even if the catalogue has since lost a row.
*/

// Prisma 7 does not load .env by itself. `prisma db seed` inherits the
// environment from the CLI, which prisma.config.ts has already populated, but
// this also has to work when the file is run directly with tsx.
for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (existsSync(full)) process.loadEnvFile(full);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in - see docs/backend.md."
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Exactly the fields this script relies on. */
interface CatalogFile {
  categories: {
    id: string;
    slug: string;
    name: string;
    blurb: string;
    imageQuery: string;
  }[];
  products: {
    id: string;
    slug: string;
    title: string;
    brand: string;
    categoryId: string;
    price: number;
    listPrice: number | null;
    dealPercent: number;
    rating: number;
    reviewCount: number;
    ratingHistogram: Record<string, number>;
    image: string | null;
    imageQuery: string;
    bullets: string[];
    specs: Record<string, string>;
    variants: {
      id: string;
      type: string;
      label: string;
      swatch?: string | null;
      priceDelta: number;
    }[];
    stock: number;
    isPrime: boolean;
    deliveryDays: number;
    boughtLastMonth: number;
    badges: string[];
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
  }[];
}

/** Brand names become ids by slugging, so the id is stable across runs. */
const brandId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  const file = path.join(process.cwd(), "data", "catalog.json");
  const catalog = JSON.parse(readFileSync(file, "utf8")) as CatalogFile;

  console.log(
    `Seeding from ${path.relative(process.cwd(), file)}: ` +
      `${catalog.categories.length} categories, ${catalog.products.length} products`
  );

  /* ---- categories ---- */
  for (const [position, c] of catalog.categories.entries()) {
    const data = {
      slug: c.slug,
      name: c.name,
      blurb: c.blurb,
      imageQuery: c.imageQuery,
      position,
    };
    await prisma.category.upsert({
      where: { id: c.id },
      create: { id: c.id, ...data },
      update: data,
    });
  }

  /* ---- brands, derived from the products that use them ---- */
  const brands = [...new Set(catalog.products.map((p) => p.brand))].sort();
  for (const name of brands) {
    await prisma.brand.upsert({
      where: { id: brandId(name) },
      create: { id: brandId(name), name },
      update: { name },
    });
  }

  /* ---- products, with their variants and reviews ---- */
  for (const [position, p] of catalog.products.entries()) {
    const data = {
      slug: p.slug,
      title: p.title,
      price: p.price,
      listPrice: p.listPrice,
      dealPercent: p.dealPercent,
      rating: p.rating,
      reviewCount: p.reviewCount,
      ratingHistogram: p.ratingHistogram,
      image: p.image,
      imageQuery: p.imageQuery,
      bullets: p.bullets,
      specs: p.specs,
      stock: p.stock,
      isPrime: p.isPrime,
      deliveryDays: p.deliveryDays,
      boughtLastMonth: p.boughtLastMonth,
      badges: p.badges as Badge[],
      position,
      categoryId: p.categoryId,
      brandId: brandId(p.brand),
    };

    await prisma.product.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });

    // Replaced rather than upserted: the catalogue is authoritative, so a
    // variant or review it no longer lists should not survive a reseed.
    await prisma.productVariant.deleteMany({ where: { productId: p.id } });
    if (p.variants.length > 0) {
      await prisma.productVariant.createMany({
        data: p.variants.map((v, i) => ({
          id: v.id,
          productId: p.id,
          type: v.type as VariantType,
          label: v.label,
          swatch: v.swatch ?? null,
          priceDelta: v.priceDelta,
          position: i,
        })),
      });
    }

    await prisma.review.deleteMany({ where: { productId: p.id } });
    if (p.reviews.length > 0) {
      await prisma.review.createMany({
        data: p.reviews.map((r) => ({
          id: r.id,
          productId: p.id,
          author: r.author,
          rating: r.rating,
          title: r.title,
          body: r.body,
          date: new Date(`${r.date}T00:00:00Z`),
          verified: r.verified,
          helpful: r.helpful,
        })),
      });
    }
  }

  const [categories, brandCount, products, variants, reviews] = await Promise.all([
    prisma.category.count(),
    prisma.brand.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.review.count(),
  ]);

  console.log(
    `Seeded: ${categories} categories, ${brandCount} brands, ${products} products, ` +
      `${variants} variants, ${reviews} reviews`
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
