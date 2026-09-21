import Image from "next/image";
import Link from "next/link";
import {
  getAllProducts,
  getBestSellers,
  getCategories,
  getDeals,
  getProductsByCategory,
  getProductsWithBadge,
} from "@/lib/catalog";
import { COMMERCE } from "@/lib/commerce";
import { formatPriceShort } from "@/lib/utils";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { CardRow, type HomeCard } from "@/components/home/CardRow";
import { ProductRail } from "@/components/home/ProductRail";
import { RecentlyViewed } from "@/components/home/RecentlyViewed";
import { SectionHeader } from "@/components/ui/SectionHeader";

/*
  Marketplace homepage.

  A contained hero, then department discovery, then merchandising: four-up card
  rows and full-width product rails alternating down the page, all on the grey
  page with white cards and tight gutters.

  Departments sit directly under the hero rather than four modules down, which
  is the one place the older reference screenshots are worth departing from.
  Category discovery is the most useful thing a marketplace homepage can put
  near the fold, and burying it behind promo tiles leans the whole page on a
  single hero carousel to do work it is bad at.

  Everything renders from the real catalogue through the shared ProductCard, so
  nothing here is a one-off.
*/

/** Picks the most-reviewed products of a department to stand in as promo art. */
function heroImage(categoryId: string): string | null {
  return (
    getProductsByCategory(categoryId).sort((a, b) => b.reviewCount - a.reviewCount)[0]?.image ?? null
  );
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "deals",
    eyebrow: "Limited time",
    headline: "Deals across every department",
    sub: `Hundreds of reductions, refreshed daily. Free delivery on eligible orders over ${formatPriceShort(
      COMMERCE.freeShippingThreshold
    )}.`,
    cta: "Shop today's deals",
    href: "/s?deals=1",
    image: heroImage("electronics"),
    background: "linear-gradient(120deg,#e7d9ff 0%,#f3ecff 55%,#ffffff 100%)",
  },
  {
    id: "computers",
    eyebrow: "New arrivals",
    headline: "Set up your desk properly",
    sub: "Laptops, monitors and the accessories that make them worth using.",
    cta: "Explore Computers",
    href: "/s?i=computers",
    image: heroImage("computers"),
    background: "linear-gradient(120deg,#d7ecff 0%,#eaf5ff 55%,#ffffff 100%)",
  },
  {
    id: "home-kitchen",
    eyebrow: "Home essentials",
    headline: "Kitchen upgrades under $50",
    sub: "Cookware, small appliances and the everyday things that wear out.",
    cta: "Shop Home & Kitchen",
    href: "/s?i=home-kitchen",
    image: heroImage("home-kitchen"),
    background: "linear-gradient(120deg,#ffe6cc 0%,#fff3e6 55%,#ffffff 100%)",
  },
  {
    id: "sports",
    eyebrow: "Get outside",
    headline: "Gear built for the weekend",
    sub: "Packs, tents and training kit rated by thousands of shoppers.",
    cta: "Shop Sports & Outdoors",
    href: "/s?i=sports",
    image: heroImage("sports"),
    background: "linear-gradient(120deg,#d8f0e4 0%,#ecf8f2 55%,#ffffff 100%)",
  },
];

/** Builds a 2x2 card from a department's top four products. */
function departmentCard(categoryId: string, title: string, linkLabel: string): HomeCard {
  const picks = getProductsByCategory(categoryId)
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 4);
  return {
    title,
    linkLabel,
    linkHref: `/s?i=${categoryId}`,
    tiles: picks.map((p) => ({
      label: p.title.split(",")[0],
      href: `/dp/${p.slug}`,
      image: p.image,
    })),
  };
}

export default function Home() {
  const categories = getCategories();
  const catalog = getAllProducts();

  const bestSellers = getBestSellers(14);
  const deals = getDeals(14);
  const electronics = getProductsByCategory("electronics").sort((a, b) => b.rating - a.rating);
  const choice = getProductsWithBadge("choice", 14);
  const home = getProductsByCategory("home-kitchen").sort((a, b) => b.reviewCount - a.reviewCount);

  const topRow: HomeCard[] = [
    departmentCard("electronics", "Top tech for every desk", "Discover more in Electronics"),
    departmentCard("home-kitchen", "Kitchen essentials under $50", "Shop Home & Kitchen"),
    departmentCard("fashion", "Shop fashion for less", "See all deals"),
    departmentCard("toys", "Toys for all ages", "See more in Toys & Games"),
  ];

  const secondRow: HomeCard[] = [
    departmentCard("sports", "Gear up to get fit", "Discover more"),
    departmentCard("beauty", "Most-loved beauty picks", "Shop Beauty"),
    departmentCard("office", "Level up your workspace", "Discover more"),
    departmentCard("pets", "Have more fun with pets", "See more"),
  ];

  return (
    <div className="pb-4">
      <div className="shell space-y-4 pt-3">
        <HeroCarousel slides={HERO_SLIDES} />

        {/* departments */}
        <section className="card p-4 sm:p-5">
          <SectionHeader
            title="Shop by department"
            subtitle={`All ${categories.length} departments, ${catalog.length} products`}
            actionLabel="Browse everything"
            actionHref="/s"
            className="mb-4"
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c, i) => (
              <Link key={c.id} href={`/s?i=${c.id}`} className="group">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[4px] bg-white">
                  {c.image && (
                    <Image
                      src={c.image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 45vw, 200px"
                      className="object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                      priority={i < 3}
                    />
                  )}
                </div>
                <p className="mt-2 text-[13px] font-bold text-ink group-hover:text-link-hover group-hover:underline">
                  {c.name}
                </p>
                <p className="clamp-1 text-[12px] text-muted">{c.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        <ProductRail
          title="Today's Deals"
          subtitle="Limited time offers across the store"
          products={deals}
          href="/s?deals=1"
        />

        <CardRow cards={topRow} />

        <ProductRail
          title="Best Sellers"
          subtitle="What shoppers are buying most this week"
          products={bestSellers}
          href="/s?sort=rating"
        />

        <CardRow cards={secondRow} />

        <ProductRail
          title="Popular in Electronics"
          subtitle="Highest rated audio, video and everyday tech"
          products={electronics}
          href="/s?i=electronics"
        />

        <RecentlyViewed catalog={catalog} />

        <ProductRail
          title="Recommended for you"
          subtitle="Kartly's Choice picks across the catalogue"
          products={choice}
          href="/s?sort=rating"
        />

        <ProductRail
          title="Best Sellers in Home & Kitchen"
          products={home}
          href="/s?i=home-kitchen"
        />
      </div>
    </div>
  );
}
