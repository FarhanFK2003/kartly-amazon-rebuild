import Link from "next/link";
import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { getCategories } from "@/lib/catalog";
import { getCartIndex } from "@/lib/commerce";
import { getNavDepartments, getNavGroups } from "@/lib/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { SearchBar } from "@/components/chrome/SearchBar";
import { CartButton } from "@/components/chrome/CartButton";
import { DepartmentDrawer } from "@/components/chrome/DepartmentDrawer";
import { DrawerTrigger } from "@/components/chrome/DrawerTrigger";
import { AccountArea } from "@/components/chrome/AccountArea";
import { SubNav } from "@/components/chrome/SubNav";
import { LocaleMenu } from "@/components/chrome/LocaleMenu";
import { HEADER_HOVER_BOX as HOVER_BOX } from "@/components/chrome/styles";
import { CartDrawer } from "@/components/cart/CartDrawer";

/*
  Two-row marketplace header.

  Heights come from measuring /recon/filter.png: the search field is 40px and the
  secondary nav 39px. The screenshot's 71px primary row is a 125% display-scale
  artefact of the capture (40 and 39 land exactly on standard values at 1.25x),
  so the primary row is built at its true 60px.

  Desktop and mobile are separate layouts rather than one shrinking layout,
  because the mobile arrangement moves search onto its own full-width row.
*/

export function SiteHeader() {
  const categories = getCategories();

  return (
    <header className="sticky top-0 z-50">
      {/* ---------------- desktop ---------------- */}
      <div className="hidden bg-header text-white lg:block">
        <div className="shell flex h-[60px] items-center gap-1">
          <Link href="/" className={`${HOVER_BOX} flex items-center`} aria-label="Kartly home">
            <Wordmark height={30} />
          </Link>

          <Link href="/" className={`${HOVER_BOX} flex items-end gap-[2px]`}>
            <MapPin className="mb-[2px] h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="leading-tight">
              <span className="block text-[12px] text-[#ccc]">Deliver to</span>
              <span className="block text-[14px] font-bold leading-[15px]">United States</span>
            </span>
          </Link>

          <div className="mx-2 min-w-0 flex-1">
            <Suspense fallback={<SearchFallback />}>
              <SearchBar categories={categories} />
            </Suspense>
          </div>

          <LocaleMenu />

          <AccountArea />

          <Link href="/orders" className={`${HOVER_BOX} leading-tight`}>
            <span className="block text-[12px]">Returns</span>
            <span className="block text-[14px] font-bold leading-[15px]">&amp; Orders</span>
          </Link>

          <CartButton />
        </div>
      </div>

      {/* ---------------- mobile / tablet ---------------- */}
      <div className="bg-header text-white lg:hidden">
        <div className="flex h-[50px] items-center gap-2 px-3">
          <DrawerTrigger ariaLabel="Open all departments" />
          <Link href="/" className="flex items-center" aria-label="Kartly home">
            <Wordmark height={24} />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <AccountArea compact />
            <CartButton compact />
          </div>
        </div>

        <div className="px-3 pb-2">
          <Suspense fallback={<SearchFallback />}>
            <SearchBar categories={categories} />
          </Suspense>
        </div>
      </div>

      <SubNav categories={categories} />

      {/*
        Rendered once for the whole app; both triggers open this instance.

        Suspense is required, not decorative: the drawer reads useSearchParams
        to highlight the active department, and without a boundary that opts
        every statically prerendered page - all 120 PDPs - out of static
        rendering and fails the build.
      */}
      <Suspense fallback={null}>
        <DepartmentDrawer departments={getNavDepartments()} groups={getNavGroups()} />
      </Suspense>

      {/*
        The mini-cart, also rendered once for the whole app.

        It needs product data for whatever is in the cart, and the cart lives in
        localStorage, so the server cannot know which products to send - the
        same problem the cart page has, solved the same way, with the shared
        index. It costs about 13KB gzipped on shop pages and buys a drawer that
        opens with no request and no loading state.
      */}
      <CartDrawer index={getCartIndex()} />
    </header>
  );
}

/** Matches the real bar's box so the header does not jump while search streams in. */
function SearchFallback() {
  return <div className="h-10 w-full rounded-[8px] bg-white/90" aria-hidden />;
}
