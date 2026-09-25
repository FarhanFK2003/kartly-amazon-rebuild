import { AppBar } from "@/components/chrome/AppBar";
import { SiteFooter } from "@/components/chrome/SiteFooter";

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
