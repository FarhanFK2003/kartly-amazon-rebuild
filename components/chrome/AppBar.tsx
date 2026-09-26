import Link from "next/link";
import { Suspense } from "react";
import { CircleHelp } from "lucide-react";
import { getCategories } from "@/lib/data/products";
import { getNavDepartments, getNavGroups } from "@/lib/navigation";
import { TID } from "@/lib/testids";
import { Wordmark } from "@/components/brand/Wordmark";
import { BrowsePopover } from "@/components/chrome/BrowsePopover";
import { SearchTrigger } from "@/components/chrome/SearchTrigger";
import { SearchOverlay } from "@/components/chrome/SearchOverlay";
import { CartButton } from "@/components/chrome/CartButton";
import { AccountArea } from "@/components/chrome/AccountArea";
import { BottomTabs } from "@/components/chrome/BottomTabs";
import { StickySentinel } from "@/components/chrome/StickySentinel";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartSync } from "@/components/cart/CartSync";

/*
  Kartly's application chrome.

  One row. The replica header it replaces was two rows and 99px before a single
  product appeared: a dark band carrying eleven controls, then a permanent
  department strip. Departments now live behind Browse and at /browse, search
  collapses to a trigger, and the delivery-location and language controls - both
  of which were decorative in a single-locale demo - are gone from the bar.
  That is 99px of standing chrome down to 56, on a light ground.

  It is fixed rather than sticky, with a spacer holding its place in flow. A
  sticky element still occupies its original space, so compressing one on scroll
  shifts the whole page by the difference. Fixed plus a constant spacer gives the
  compression for free with no layout shift.

  Desktop and mobile are the same component, arranged by CSS. There is one set
  of navigation data, one search implementation and one cart control; only the
  layout differs, which is what stops the two from drifting apart.
*/
export async function AppBar() {
  // Both reads are cached per request, so the header costs the same whether the
  // page below it also needs categories.
  const [categories, departments, groups] = await Promise.all([
    getCategories(),
    getNavDepartments(),
    Promise.resolve(getNavGroups()),
  ]);

  return (
    <>
      <StickySentinel />

      {/* Holds the bar's place in flow so compression cannot shift the page. */}
      <div aria-hidden className="h-[52px] lg:h-[56px]" />

      <header
        data-testid={TID.appBar}
        className={[
          "fixed inset-x-0 top-0 z-[60] border-b border-line bg-paper/95 backdrop-blur-[6px]",
          "h-[52px] lg:h-[56px]",
          // Compresses once the page has scrolled past the sentinel.
          "transition-[height] duration-200 ease-out",
          "[:root[data-scrolled]_&]:lg:h-12",
        ].join(" ")}
      >
        <div className="shell flex h-full items-center gap-2 lg:gap-3">
          <Link
            href="/"
            aria-label="Kartly home"
            className="flex shrink-0 items-center rounded-[var(--radius-sm)] px-1 py-1 transition-transform"
          >
            <span className="block [:root[data-scrolled]_&]:lg:scale-90 transition-transform duration-200">
              <Wordmark height={24} />
            </span>
          </Link>

          {/* ---------------- desktop ---------------- */}
          <div className="hidden shrink-0 lg:block">
            <BrowsePopover departments={departments} groups={groups} />
          </div>

          <div className="hidden min-w-0 flex-1 lg:block">
            <SearchTrigger />
          </div>

          <nav aria-label="Account and orders" className="hidden shrink-0 items-center gap-1 lg:flex">
            <BarLink href="/help" icon>
              <CircleHelp className="h-4 w-4" aria-hidden />
              Help
            </BarLink>
            <BarLink href="/orders">Orders</BarLink>
            <AccountArea />
            <CartButton />
          </nav>

          {/* ---------------- mobile ---------------- */}
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <SearchTrigger variant="icon" />
            <CartButton compact />
          </div>
        </div>
      </header>

      {/*
        Rendered once for the whole application.

        Suspense is required, not decorative: the overlay's descendants read
        client navigation state, and an unguarded read opts every statically
        prerendered page - all 120 PDPs - out of static rendering and fails the
        build.
      */}
      <Suspense fallback={null}>
        <SearchOverlay categories={categories} />
      </Suspense>

      <CartSync />
      <CartDrawer />

      <BottomTabs />
    </>
  );
}

function BarLink({
  href,
  children,
  icon = false,
}: {
  href: string;
  children: React.ReactNode;
  icon?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex h-9 items-center rounded-[var(--radius-sm)] px-3 text-body font-medium text-ink",
        "transition-colors hover:bg-surface-sunk",
        icon ? "gap-[6px]" : "",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
