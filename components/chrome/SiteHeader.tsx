import Link from "next/link";
import { Suspense } from "react";
import { MapPin, ChevronDown, Globe } from "lucide-react";
import { getCategories } from "@/lib/catalog";
import { Wordmark } from "@/components/brand/Wordmark";
import { SearchBar } from "@/components/chrome/SearchBar";
import { CartButton } from "@/components/chrome/CartButton";
import { MobileMenu } from "@/components/chrome/MobileMenu";
import { SubNav } from "@/components/chrome/SubNav";

/*
  Two-row marketplace header.

  Heights come from measuring /recon/filter.png: the search field is 40px and the
  secondary nav 39px. The screenshot's 71px primary row is a 125% display-scale
  artefact of the capture (40 and 39 land exactly on standard values at 1.25x),
  so the primary row is built at its true 60px.

  Desktop and mobile are separate layouts rather than one shrinking layout,
  because the mobile arrangement moves search onto its own full-width row.
*/

const HOVER_BOX =
  "rounded-[2px] border border-transparent px-2 py-1 hover:border-white transition-colors";

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

          {/* A globe rather than a flag emoji: Windows ships no glyph for
              regional-indicator pairs, so a flag renders as bare letters. */}
          <button type="button" className={`${HOVER_BOX} flex items-center gap-1 text-[14px] font-bold`}>
            <Globe className="h-4 w-4 text-[#ccc]" strokeWidth={2} />
            EN
            <ChevronDown className="h-3 w-3 text-[#ccc]" />
          </button>

          <Link href="/signin" className={`${HOVER_BOX} leading-tight`}>
            <span className="block text-[12px]">Hello, sign in</span>
            <span className="flex items-center gap-[2px] text-[14px] font-bold leading-[15px]">
              Account &amp; Lists
              <ChevronDown className="h-3 w-3 text-[#ccc]" />
            </span>
          </Link>

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
          <MobileMenu categories={categories} />
          <Link href="/" className="flex items-center" aria-label="Kartly home">
            <Wordmark height={24} />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/signin" className={`${HOVER_BOX} text-[13px] font-bold`}>
              Sign in
            </Link>
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
    </header>
  );
}

/** Matches the real bar's box so the header does not jump while search streams in. */
function SearchFallback() {
  return <div className="h-10 w-full rounded-[8px] bg-white/90" aria-hidden />;
}
