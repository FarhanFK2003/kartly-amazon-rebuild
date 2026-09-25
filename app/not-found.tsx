import Link from "next/link";
import Image from "next/image";
import { getCategories, getBestSellers } from "@/lib/catalog";
import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

/*
  Global 404.

  This is the root not-found boundary, which renders outside the (shop) layout
  and therefore without its header and footer, so it carries its own minimal
  chrome. It is never a dead end: there is a search box, every department, and
  a row of real products to click.
*/
export default function NotFound() {
  const categories = getCategories();
  const picks = getBestSellers(6);

  return (
    <html lang="en" className={fontVariables}>
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="bg-header">
            <div className="shell flex h-[60px] items-center">
              <Link href="/" className="flex items-center text-white" aria-label="Kartly home">
                <Wordmark height={30} />
              </Link>
            </div>
          </header>

          <main className="flex-1">
            <div className="shell py-10 sm:py-16">
              <div className="card mx-auto max-w-[760px] px-6 py-10 text-center">
                <p className="text-[56px] font-bold leading-none text-[#e3e6e6] sm:text-[72px]">404</p>
                <h1 className="mt-2 text-[24px] font-normal leading-8 text-ink sm:text-[28px]">
                  We can&apos;t find that page
                </h1>
                <p className="mx-auto mt-2 max-w-[460px] text-[14px] text-muted">
                  The link may be broken, or the page may have moved. Here are some ways back in.
                </p>

                <form action="/s" method="get" role="search" className="mx-auto mt-6 flex h-10 max-w-[420px] overflow-hidden rounded-[8px] border border-[#888c8c]">
                  <input
                    name="q"
                    type="search"
                    placeholder="Search Kartly"
                    aria-label="Search Kartly"
                    className="min-w-0 flex-1 px-3 text-[15px] text-ink placeholder:text-[#888] focus:outline-none"
                  />
                  <button type="submit" className="shrink-0 bg-search px-4 text-[14px] font-medium text-ink hover:bg-search-hover">
                    Search
                  </button>
                </form>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <ButtonLink href="/" variant="primary" size="md">
                    Go to the homepage
                  </ButtonLink>
                  <ButtonLink href="/s" variant="outline" size="md">
                    Browse all products
                  </ButtonLink>
                </div>
              </div>

              <section className="card mx-auto mt-4 max-w-[760px] p-5">
                <h2 className="text-[16px] font-bold text-ink">Popular departments</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/s?i=${c.id}`}
                        className="inline-block rounded-full border border-line bg-white px-3 py-[5px] text-[13px] text-ink hover:border-[#007185] hover:text-link"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card mx-auto mt-4 max-w-[760px] p-5">
                <h2 className="text-[16px] font-bold text-ink">Best Sellers</h2>
                <div className="no-scrollbar mt-3 flex gap-4 overflow-x-auto pb-1">
                  {picks.map((p) => (
                    <Link key={p.id} href={`/dp/${p.slug}`} className="w-[120px] shrink-0 group">
                      <div className="relative aspect-square w-full overflow-hidden rounded-[4px] bg-white">
                        {p.image && (
                          <Image src={p.image} alt="" fill sizes="120px" className="object-contain" />
                        )}
                      </div>
                      <p className="clamp-2 mt-1 text-[12px] leading-4 text-link group-hover:underline">
                        {p.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </main>

          <footer className="bg-footer py-6 text-center">
            <p className="text-[12px] text-[#ddd]">
              Kartly is an original demo storefront. Not affiliated with Amazon.com, Inc.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
