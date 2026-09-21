import type { Metadata } from "next";
import Link from "next/link";
import { Search, ChevronDown, LifeBuoy } from "lucide-react";
import {
  HELP_TOPICS,
  articlesByTopic,
  searchHelp,
  type HelpArticle,
} from "@/lib/help";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Help Centre" };

/*
  Help centre.

  Search is a plain GET form, and every answer is a native <details> element, so
  the whole page works with no JavaScript and is keyboard accessible without any
  custom key handling.
*/
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  const results = query ? searchHelp(query) : [];

  return (
    <div className="shell py-4">
      {/* heading and search */}
      <section className="card px-5 py-7 text-center sm:px-8 sm:py-9">
        <h1 className="text-[24px] font-normal leading-9 text-ink sm:text-[28px]">Kartly Help Centre</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14px] text-muted">
          Answers about orders, delivery, payments and what is simulated in this demo.
        </p>

        <form
          action="/help"
          method="get"
          role="search"
          className="mx-auto mt-5 flex h-10 max-w-[520px] overflow-hidden rounded-[8px] border border-[#888c8c] bg-white focus-within:shadow-[0_0_0_3px_rgba(228,121,17,.4)]"
        >
          <label htmlFor="help-q" className="sr-only">
            Search help topics
          </label>
          <input
            id="help-q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search help, e.g. delivery or refund"
            className="min-w-0 flex-1 px-4 text-[15px] text-ink placeholder:text-[#888] focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-2 bg-search px-4 text-[14px] font-medium text-ink hover:bg-search-hover"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
      </section>

      {query ? (
        <SearchResults query={query} results={results} />
      ) : (
        <>
          {/* topic grid */}
          <section className="card mt-4 p-5">
            <h2 className="text-[18px] font-bold text-ink">Browse help topics</h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HELP_TOPICS.map((topic) => (
                <li key={topic.id}>
                  <Link
                    href={`#${topic.id}`}
                    className="block h-full rounded-[8px] border border-line bg-white p-4 hover:border-[#007185] hover:bg-[#f7fafa]"
                  >
                    <p className="text-[15px] font-bold text-ink">{topic.title}</p>
                    <p className="mt-[2px] text-[13px] text-muted">{topic.blurb}</p>
                    <p className="mt-2 text-[12px] text-link">
                      {articlesByTopic(topic.id).length} articles
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* all topics */}
          {HELP_TOPICS.map((topic) => (
            <section key={topic.id} id={topic.id} className="card mt-4 scroll-mt-[120px] p-5">
              <h2 className="text-[18px] font-bold text-ink">{topic.title}</h2>
              <p className="mt-[2px] text-[13px] text-muted">{topic.blurb}</p>
              <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
                {articlesByTopic(topic.id).map((article) => (
                  <Article key={article.id} article={article} />
                ))}
              </div>
            </section>
          ))}

          <ContactCta />
        </>
      )}
    </div>
  );
}

function SearchResults({ query, results }: { query: string; results: HelpArticle[] }) {
  if (results.length === 0) {
    return (
      <>
        <section className="card mt-4 px-5 py-14 text-center">
          <p className="text-[18px] font-bold text-ink sm:text-[21px]">
            No help articles match <span className="text-[#c7511f]">&quot;{query}&quot;</span>
          </p>
          <p className="mx-auto mt-2 max-w-[460px] text-[14px] text-muted">
            Try a broader word such as delivery, refund, payment or account. You can also browse
            every topic below.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/help" variant="primary" size="md">
              Browse all help topics
            </ButtonLink>
            <Link href="/s" className="link text-[14px]">
              Continue shopping
            </Link>
          </div>
        </section>

        <section className="card mt-4 p-5">
          <h2 className="text-[16px] font-bold text-ink">Popular topics</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {HELP_TOPICS.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/help#${t.id}`}
                  className="inline-block rounded-full border border-line bg-white px-3 py-[5px] text-[13px] text-ink hover:border-[#007185] hover:text-link"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="card mt-4 p-5">
        <h2 className="text-[16px] text-ink">
          {results.length} {results.length === 1 ? "result" : "results"} for{" "}
          <span className="font-bold text-[#c7511f]">&quot;{query}&quot;</span>
        </h2>
        <div className="mt-3 divide-y divide-line-soft border-t border-line-soft">
          {results.map((article) => (
            <Article key={article.id} article={article} defaultOpen={results.length <= 3} />
          ))}
        </div>
        <Link href="/help" className="link mt-4 inline-block text-[13px]">
          Clear search and browse all topics
        </Link>
      </section>

      <ContactCta />
    </>
  );
}

/** Native disclosure: keyboard accessible with no JavaScript at all. */
function Article({ article, defaultOpen = false }: { article: HelpArticle; defaultOpen?: boolean }) {
  return (
    <details className="group py-1" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-[10px] text-[14px] font-bold text-ink marker:content-none hover:text-link [&::-webkit-details-marker]:hidden">
        {article.question}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="pb-3 pr-6">
        <p className="text-[14px] leading-[21px] text-ink">{article.answer}</p>
        {article.links && article.links.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {article.links.map((link) => (
              <li key={link.href + link.label}>
                <Link href={link.href} className="link text-[13px]">
                  {link.label} &rsaquo;
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function ContactCta() {
  return (
    <section className="card mt-4 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
      <LifeBuoy className="h-9 w-9 shrink-0 text-muted" strokeWidth={1.6} aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-bold text-ink">Still need a hand?</h2>
        <p className="mt-1 text-[13px] leading-[19px] text-muted">
          Kartly is a demo storefront, so there is no support team to contact and no ticket to
          raise. Nothing you do here can affect a real order or a real payment. If something looks
          broken, it is a bug in the demo rather than a problem with your account.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <ButtonLink href="/orders" variant="outline" size="md">
          Your Orders
        </ButtonLink>
        <ButtonLink href="/s" variant="primary" size="md">
          Continue shopping
        </ButtonLink>
      </div>
    </section>
  );
}
