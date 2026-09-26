import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Product } from "@/lib/types";

/**
 * Horizontally scrolling rail. Cards keep a fixed width so the row scrolls
 * rather than reflowing, which is what makes it read as a carousel at every
 * breakpoint without any JavaScript.
 */
export function RelatedProducts({
  products,
  title,
  subtitle,
}: {
  products: Product[];
  title: string;
  subtitle?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-line-soft pt-6">
      <SectionHeader title={title} subtitle={subtitle} size="md" className="mb-4" />
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-[170px] shrink-0 sm:w-[200px]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
