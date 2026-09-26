import { AppBar } from "@/components/chrome/AppBar";
import { SiteFooter } from "@/components/chrome/SiteFooter";

/*
  Every route in this group renders per request.

  The app bar below reads its departments from PostgreSQL, and most pages in
  the group read products, so nothing here can be frozen at build time - a
  price corrected in the database has to be on the page at the next request,
  which is the whole point of the migration. Declaring it once on the layout
  covers the group rather than repeating it on each route.

  The cost is real: every page is a server render with database round trips to
  Singapore. Incremental regeneration with an explicit revalidation hook is the
  right production answer, but it needs an invalidation path that something
  actually calls, and shipping a cache nobody knows how to clear would be worse
  than rendering honestly. Recorded in docs/backend.md.
*/
export const dynamic = "force-dynamic";

/*
  Shop chrome. Checkout deliberately lives outside this group so it can render a
  stripped header with no nav or search, which is what keeps shoppers in the
  payment flow.

  relative, because the app bar's scroll sentinel is positioned against it.
  The bottom padding is the mobile tab bar's clearance plus the iOS home
  indicator, so fixed navigation never covers the end of a page.
*/
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AppBar />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <div
        aria-hidden
        className="h-[calc(56px+env(safe-area-inset-bottom))] lg:hidden"
      />
    </div>
  );
}
