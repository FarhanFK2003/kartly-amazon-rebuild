import { getDepartmentStats } from "./data/products";

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
export async function getNavDepartments(): Promise<NavDepartment[]> {
  // Counts and stocked brands are grouped queries in the read layer rather
  // than a scan over every product here.
  const stats = await getDepartmentStats();
  return stats.map((d) => ({
    id: d.id,
    name: d.name,
    blurb: d.blurb,
    count: d.count,
    brands: d.brands,
  }));
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
