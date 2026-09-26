"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { useCart } from "@/lib/store/cart";
import { TID } from "@/lib/testids";
import { ADD_FEEDBACK_MS, useCartDrawer } from "@/lib/store/cartDrawer";
import { formatPrice, pluralize, cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

/**
 * Frequently bought together.
 *
 * Deliberately compact: a thumbnail strip, a running total and a checkbox list.
 * It sits between the buy box and the specifications, where it is easy to
 * notice and impossible to mistake for the main purchase control.
 *
 * Adding routes through the existing cart store, so there is no second copy of
 * the add-to-cart rules here.
 */
export function FrequentlyBoughtTogether({ bundle }: { bundle: Product[] }) {
  const add = useCart((s) => s.add);
  const openDrawer = useCartDrawer((s) => s.openDrawer);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(bundle.map((p) => [p.id, true]))
  );
  const [addedCount, setAddedCount] = useState(0);

  const chosen = useMemo(() => bundle.filter((p) => selected[p.id]), [bundle, selected]);
  const total = chosen.reduce((sum, p) => sum + p.price, 0);

  if (bundle.length < 3) return null;

  const anchor = bundle[0];

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
    setAddedCount(0);
  }

  function addSelected() {
    for (const p of chosen) add(p.id, 1, null);
    setAddedCount(chosen.length);
    // No highlight: several items land at once, so singling one out would be
    // arbitrary. The drawer showing all of them is the confirmation.
    openDrawer(null);
    window.setTimeout(() => setAddedCount(0), ADD_FEEDBACK_MS);
  }

  return (
    <section data-testid={TID.bundle} className="border-t border-line pt-6" aria-labelledby="fbt-heading">
      <h2 id="fbt-heading" className="font-display text-display-md font-medium text-ink">
        Frequently bought together
      </h2>

      <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* thumbnail strip */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {bundle.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 sm:gap-3">
              {i > 0 && <Plus className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />}
              <Link
                href={`/dp/${p.slug}`}
                title={p.title}
                className={cn(
                  "relative block h-[96px] w-[96px] shrink-0 rounded-[var(--radius-sm)] border bg-surface p-1 transition-opacity sm:h-[116px] sm:w-[116px]",
                  selected[p.id] ? "border-line opacity-100" : "border-line opacity-40"
                )}
              >
                {p.image && (
                  <Image src={p.image} alt={p.title} fill sizes="116px" className="object-contain p-1" />
                )}
              </Link>
            </div>
          ))}
        </div>

        {/* total and action */}
        <div className="shrink-0 xl:w-[240px]">
          <p className="text-body-sm text-ink-2">
            Total price for {chosen.length} {pluralize(chosen.length, "item")}
          </p>
          <PriceBlock cents={total} size="md" className="mt-[2px]" />

          <Button
            variant="primary"
            size="md"
            className="mt-3 w-full max-w-[240px]"
            onClick={addSelected}
            disabled={chosen.length === 0}
          >
            {addedCount > 0 ? (
              <>
                <Check className="h-4 w-4" />
                Added {addedCount} to cart
              </>
            ) : chosen.length === 0 ? (
              "Select an item"
            ) : (
              `Add ${chosen.length} ${pluralize(chosen.length, "item")} to Cart`
            )}
          </Button>
        </div>

        {/* checkbox list */}
        <ul className="min-w-0 flex-1 space-y-2 xl:border-l xl:border-line xl:pl-6">
          {bundle.map((p) => {
            const isAnchor = p.id === anchor.id;
            const on = !!selected[p.id];
            return (
              <li key={p.id}>
                <label className="flex w-full cursor-pointer items-start gap-2 text-body-sm leading-[18px]">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(p.id)}
                    className="mt-[2px] h-[15px] w-[15px] shrink-0 cursor-pointer accent-[#007185]"
                    aria-label={`${on ? "Remove" : "Include"} ${p.title}`}
                  />
                  <span className="min-w-0 break-words">
                    {isAnchor && <span className="font-bold text-ink">This item: </span>}
                    <Link
                      href={`/dp/${p.slug}`}
                      className={cn("hover:text-link-hover hover:underline", on ? "text-link" : "text-ink-2")}
                    >
                      {p.title.split(",")[0]}
                    </Link>
                    <span className="ml-1 whitespace-nowrap font-bold text-ink">
                      {formatPrice(p.price)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
