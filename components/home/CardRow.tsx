import Image from "next/image";
import Link from "next/link";

export interface CardTile {
  label: string;
  href: string;
  image: string | null;
}

export interface HomeCard {
  title: string;
  linkLabel: string;
  linkHref: string;
  /** One large image, or a 2x2 grid of labelled tiles. */
  tiles: CardTile[];
}

/**
 * The four-up white card row that gives a marketplace homepage its texture:
 * a bold title, either one large image or a 2x2 grid of labelled tiles, and a
 * blue link anchored at the bottom. Taken straight from the recon homepage.
 */
export function CardRow({ cards }: { cards: HomeCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <section key={card.title} className="card flex flex-col p-5">
          <h2 className="mb-3 text-[19px] font-bold leading-6 text-ink">{card.title}</h2>

          {card.tiles.length === 1 ? (
            <Link href={card.tiles[0].href} className="group block">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                {card.tiles[0].image && (
                  <Image
                    src={card.tiles[0].image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 90vw, 300px"
                    className="object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                )}
              </div>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {card.tiles.slice(0, 4).map((tile) => (
                <Link key={tile.label} href={tile.href} className="group block">
                  <div className="relative aspect-square w-full overflow-hidden bg-white">
                    {tile.image && (
                      <Image
                        src={tile.image}
                        alt=""
                        fill
                        sizes="150px"
                        className="object-contain transition-transform duration-200 group-hover:scale-[1.04]"
                      />
                    )}
                  </div>
                  <p className="clamp-1 mt-1 text-[12px] leading-4 text-ink group-hover:text-link-hover group-hover:underline">
                    {tile.label}
                  </p>
                </Link>
              ))}
            </div>
          )}

          <Link href={card.linkHref} className="link mt-auto pt-3 text-[13px]">
            {card.linkLabel}
          </Link>
        </section>
      ))}
    </div>
  );
}
