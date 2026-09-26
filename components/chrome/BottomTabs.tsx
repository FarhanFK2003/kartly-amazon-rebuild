"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingCart, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { useHydratedCartCount } from "@/lib/store/cart";
import { useSearchOverlay } from "@/lib/store/searchOverlay";

/**
 * Mobile primary navigation.
 *
 * Replaces a hamburger and a left drawer. Both put the whole navigation of the
 * store behind one off-screen control at the top-left corner of a phone - the
 * hardest place on the device to reach and the easiest to forget exists. Five
 * destinations, always visible, in the thumb arc.
 *
 * It is a <nav> of real links. Only Search is special: it opens the overlay
 * once mounted and otherwise navigates to /s, which is what keeps it working
 * before hydration.
 */
export function BottomTabs() {
  const pathname = usePathname();
  const count = useHydratedCartCount();
  const openSearch = useSearchOverlay((s) => s.openSearch);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href.split("?")[0]);

  return (
    <nav
      aria-label="Primary"
      data-testid={TID.bottomTabs}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[70] bg-surface lg:hidden",
        // Sits above the home indicator on iOS rather than under it.
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      {/* The top border lives on the row, not the nav, so the bar's total height
          is exactly 56px and the shell's spacer clears it to the pixel. */}
      <ul className="flex h-[56px] items-stretch border-t border-line">
        <Tab href="/" label="Home" icon={Home} active={!!isActive("/")} />
        <Tab href="/browse" label="Browse" icon={LayoutGrid} active={!!isActive("/browse")} />
        <Tab
          href="/s"
          label="Search"
          icon={Search}
          active={!!isActive("/s")}
          onClick={(e) => {
            e.preventDefault();
            openSearch();
          }}
        />
        <Tab
          href="/cart"
          label="Cart"
          icon={ShoppingCart}
          active={!!isActive("/cart")}
          badge={count}
        />
        <Tab href="/orders" label="Orders" icon={Package} active={!!isActive("/orders")} />
      </ul>
    </nav>
  );
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  badge?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        aria-label={badge ? `${label}, ${badge} ${badge === 1 ? "item" : "items"}` : undefined}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-[2px] px-1",
          "text-label transition-colors",
          active ? "text-brand-ink" : "text-ink-2"
        )}
      >
        <span className="relative">
          <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
          {typeof badge === "number" && badge > 0 && (
            <span className="tnum absolute -right-[9px] -top-[5px] min-w-[16px] rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-[16px] text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
        <span className={cn(active && "font-semibold")}>{label}</span>
      </Link>
    </li>
  );
}
