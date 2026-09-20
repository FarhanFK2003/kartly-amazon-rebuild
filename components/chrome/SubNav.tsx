import Link from "next/link";
import type { Category } from "@/lib/types";
import { MobileMenu } from "@/components/chrome/MobileMenu";

const SHORTCUTS = [
  { label: "Today's Deals", href: "/s?deals=1" },
  { label: "Customer Service", href: "/help" },
  { label: "Registry", href: "/help" },
  { label: "Gift Cards", href: "/help" },
  { label: "Sell", href: "/help" },
];

/**
 * Secondary nav, 39px as measured. On narrow screens it scrolls horizontally
 * rather than wrapping, so it can never push the page into a horizontal scroll.
 */
export function SubNav({ categories }: { categories: Category[] }) {
  return (
    <nav className="bg-subnav text-white" aria-label="Departments and shortcuts">
      <div className="shell flex h-[39px] items-center gap-1 overflow-x-auto no-scrollbar">
        <div className="hidden lg:block">
          <MobileMenu categories={categories} label="All" />
        </div>

        {SHORTCUTS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="whitespace-nowrap rounded-[2px] border border-transparent px-2 py-[6px] text-[14px] hover:border-white"
          >
            {item.label}
          </Link>
        ))}

        {categories.slice(0, 4).map((c) => (
          <Link
            key={c.id}
            href={`/s?i=${c.id}`}
            className="hidden whitespace-nowrap rounded-[2px] border border-transparent px-2 py-[6px] text-[14px] hover:border-white xl:block"
          >
            {c.name}
          </Link>
        ))}

        <span className="ml-auto hidden whitespace-nowrap pl-4 text-[14px] text-white/90 xl:block">
          Free delivery on eligible orders
        </span>
      </div>
    </nav>
  );
}
