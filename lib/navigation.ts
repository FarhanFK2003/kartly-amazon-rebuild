import { getAllProducts, getCategories } from "./catalog";

export interface NavDepartment {
  id: string;
  name: string;
  blurb: string;
  count: number;
  /** Real brands stocked in this department, most products first. */
  brands: string[];
}

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

/**
 * Department navigation, derived entirely from the catalogue.
 *
 * Nothing here is invented: counts are real product counts and the sub-links
 * are brands actually stocked in that department, so every row in the drawer
 * lands on a result set with something in it.
 */
export function getNavDepartments(): NavDepartment[] {
  const products = getAllProducts();

  return getCategories().map((c) => {
    const inCategory = products.filter((p) => p.categoryId === c.id);

    const byBrand = new Map<string, number>();
    for (const p of inCategory) byBrand.set(p.brand, (byBrand.get(p.brand) ?? 0) + 1);

    return {
      id: c.id,
      name: c.name,
      blurb: c.blurb,
      count: inCategory.length,
      brands: [...byBrand.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([brand]) => brand),
    };
  });
}

/**
 * Secondary groups. Deliberately short, and deliberately limited to routes that
 * exist - a navigation drawer full of links to nowhere is worse than a small
 * one that works.
 */
export function getNavGroups(): NavGroup[] {
  return [
    {
      title: "Trending",
      links: [
        { label: "Today's Deals", href: "/s?deals=1" },
        { label: "Best Sellers", href: "/s?sort=rating" },
        { label: "New Arrivals", href: "/s?sort=newest" },
        { label: "Browse all products", href: "/s" },
      ],
    },
    {
      title: "Your Kartly",
      links: [
        { label: "Your Orders", href: "/orders" },
        { label: "Your Cart", href: "/cart" },
      ],
    },
  ];
}
