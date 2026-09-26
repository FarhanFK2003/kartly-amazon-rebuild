import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TID } from "@/lib/testids";
import { cn } from "@/lib/utils";

export interface MosaicTile {
  id: string;
  name: string;
  blurb: string;
  count: number;
  image: string | null;
}

/*
  Department discovery.

  The replica showed ten departments as ten identical tiles in a uniform grid,
  which states that every department matters exactly as much as every other and
  gives the eye nowhere to land. This is asymmetric on purpose: two departments
  get a large image-led panel, the rest get a compact row that is quicker to
  scan than a picture would be.

  Which two lead is not an editorial opinion: the page ranks departments by the
  total reviews their products carry, which is a real measure of what shoppers
  engage with. Counts shown are real product counts.
*/
export function CategoryMosaic({ tiles }: { tiles: MosaicTile[] }) {
  if (tiles.length === 0) return null;
  const [lead, second, ...rest] = tiles;

  return (
    <section data-testid={TID.categorySection} className="border-t border-line pt-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-display-md font-medium text-ink">Shop by department</h2>
          <p className="mt-1 text-body text-ink-2">
            Ten departments, each one small enough to read end to end.
          </p>
        </div>
        <Link
          href="/browse"
          className="hidden shrink-0 items-center gap-1 text-body font-medium text-brand-ink hover:underline sm:inline-flex"
        >
          All departments
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* two feature panels */}
        {[lead, second].filter(Boolean).map((t, i) => (
          <Feature key={t.id} tile={t} priority={i === 0} />
        ))}

        {/* the rest, as a compact index */}
        <ul className="flex flex-col justify-center divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface px-4">
          {rest.map((t) => (
            <li key={t.id}>
              <Link
                href={`/s?i=${t.id}`}
                className="group flex items-center justify-between gap-3 py-[11px]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink transition-colors group-hover:text-brand-ink">
                    {t.name}
                  </span>
                  <span className="clamp-1 block text-body-sm text-ink-3">{t.blurb}</span>
                </span>
                <span className="tnum shrink-0 text-body-sm text-ink-3">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/browse"
        className="mt-4 inline-flex items-center gap-1 text-body font-medium text-brand-ink hover:underline sm:hidden"
      >
        All departments
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function Feature({ tile, priority }: { tile: MosaicTile; priority?: boolean }) {
  return (
    <Link
      href={`/s?i=${tile.id}`}
      className={cn(
        "group relative flex min-h-[260px] flex-col justify-end overflow-hidden rounded-[var(--radius-md)]",
        "border border-line bg-surface-sunk p-5 sm:min-h-[320px]"
      )}
    >
      {tile.image && (
        <Image
          src={tile.image}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 420px"
          priority={priority}
          className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
        />
      )}

      {/* Keeps the label legible over any photograph without tinting the image. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/85 via-ink/45 to-transparent"
      />

      <span className="relative">
        <span className="block font-display text-display-sm font-medium text-white">{tile.name}</span>
        <span className="mt-[2px] flex items-center gap-2 text-body-sm text-white/80">
          <span className="tnum">{tile.count} products</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
