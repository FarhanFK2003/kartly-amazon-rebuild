import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Database diagnostics",
  robots: { index: false, follow: false },
};

// Reads a live database, so it can never be prerendered.
export const dynamic = "force-dynamic";

/*
  Database diagnostics.

  This is the one page rendered entirely from PostgreSQL. It exists to make the
  claim "the backend is real" checkable by a person rather than only by a test:
  every number below is counted in the database at the moment the page is
  requested, and the sample product is a row, not a fixture.

  It reads Prisma directly instead of fetching its own API, because a server
  component calling back into the same server over HTTP adds a hop and a second
  failure mode to a page whose entire job is to report on the first one.

  Kept deliberately apart from the storefront: it renders nothing the shop
  depends on, so a database outage degrades this page and nothing else.
*/
export default async function DiagnosticsPage() {
  const result = await readDatabase();

  return (
    <div className="shell py-8">
      <header className="mb-6">
        <h1 className="font-display text-[28px] leading-tight text-ink">Database diagnostics</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
          Every figure on this page is read from PostgreSQL when the page is
          requested. Nothing here is served from{" "}
          <code className="rounded bg-surface-sunk px-1 py-0.5 text-[13px]">data/catalog.json</code>.
        </p>
      </header>

      {result.ok ? (
        <>
          <section aria-labelledby="counts-heading" className="card border border-line p-5">
            <h2 id="counts-heading" className="text-[15px] font-medium text-ink">
              Row counts
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
              {(
                [
                  ["Categories", result.counts.categories],
                  ["Brands", result.counts.brands],
                  ["Products", result.counts.products],
                  ["Variants", result.counts.variants],
                  ["Reviews", result.counts.reviews],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[13px] text-ink-3">{label}</dt>
                  <dd className="font-display text-[26px] leading-none text-ink tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[13px] text-ink-3">
              Query round trip: {result.latencyMs} ms
            </p>
          </section>

          {result.sample && (
            <section
              aria-labelledby="sample-heading"
              className="card mt-4 border border-line p-5"
            >
              <h2 id="sample-heading" className="text-[15px] font-medium text-ink">
                Sample row
              </h2>
              <p className="mt-1 text-[13px] text-ink-3">
                The first product by catalogue position, as stored.
              </p>
              <dl className="mt-4 space-y-2 text-[14px]">
                {(
                  [
                    ["id", result.sample.id],
                    ["title", result.sample.title],
                    ["brand", result.sample.brand],
                    ["category", result.sample.category],
                    ["price (minor units)", String(result.sample.price)],
                    ["updatedAt", result.sample.updatedAt],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-wrap gap-x-3">
                    <dt className="w-[180px] shrink-0 text-ink-3">{label}</dt>
                    <dd className="font-mono text-[13px] text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[13px] text-ink-2">
                Same row over HTTP:{" "}
                <Link
                  href={`/api/products/${result.sample.id}`}
                  className="text-brand-ink underline underline-offset-2 hover:text-brand-ink-hover"
                >
                  /api/products/{result.sample.id}
                </Link>
              </p>
            </section>
          )}
        </>
      ) : (
        <section
          role="alert"
          className="card border border-accent/30 bg-accent-tint p-5"
        >
          <h2 className="text-[15px] font-medium text-ink">Database unavailable</h2>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
            The application could not reach PostgreSQL. The reason has been written
            to the server log rather than shown here, because connection errors
            carry the host, user and database name.
          </p>
          <p className="mt-2 text-[14px] text-ink-2">
            See <code className="rounded bg-surface px-1 py-0.5 text-[13px]">docs/backend.md</code>{" "}
            for local setup.
          </p>
        </section>
      )}

      <p className="mt-6 text-[13px] text-ink-3">
        Endpoints:{" "}
        <Link href="/api/health" className="text-brand-ink underline underline-offset-2">
          /api/health
        </Link>
        {" · "}
        <Link href="/api/products?limit=3" className="text-brand-ink underline underline-offset-2">
          /api/products
        </Link>
      </p>
    </div>
  );
}

type DbReport =
  | {
      ok: true;
      latencyMs: number;
      counts: {
        categories: number;
        brands: number;
        products: number;
        variants: number;
        reviews: number;
      };
      sample: {
        id: string;
        title: string;
        brand: string;
        category: string;
        price: number;
        updatedAt: string;
      } | null;
    }
  | { ok: false };

async function readDatabase(): Promise<DbReport> {
  try {
    const started = Date.now();

    const [categories, brands, products, variants, reviews] = await Promise.all([
      prisma.category.count(),
      prisma.brand.count(),
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.review.count(),
    ]);

    const first = await prisma.product.findFirst({
      orderBy: { position: "asc" },
      include: {
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    return {
      ok: true,
      latencyMs: Date.now() - started,
      counts: { categories, brands, products, variants, reviews },
      sample: first
        ? {
            id: first.id,
            title: first.title,
            brand: first.brand.name,
            category: first.category.name,
            price: first.price,
            updatedAt: first.updatedAt.toISOString(),
          }
        : null,
    };
  } catch (error) {
    // Logged server-side only; the page shows a generic failure state.
    console.error("[diagnostics] database read failed:", error);
    return { ok: false };
  }
}
