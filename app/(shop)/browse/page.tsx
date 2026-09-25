import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getNavDepartments } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Browse all departments",
  description: "Every Kartly department, with what is in each one.",
};

/*
  Department index.

  A route shell for wave 1. Departments used to live only inside a modal drawer,
  which meant the store's entire navigation had no address: it could not be
  linked to, shared, opened in a new tab or indexed. This gives it one.

  The full discovery experience - representative products per department, brand
  entry points, merchandising - belongs to the product-discovery wave. What is
  here is deliberately the minimum that makes the destination real, built from
  the existing navigation data with nothing invented.
*/
export default function BrowsePage() {
  const departments = getNavDepartments();
  const total = departments.reduce((n, d) => n + d.count, 0);

  return (
    <div className="shell py-8">
      <header className="mb-8">
        <h1 className="font-display text-display-lg font-medium text-ink">Browse</h1>
        <p className="mt-1 text-body text-ink-2">
          {departments.length} departments, {total} products.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <li key={d.id}>
            <Link
              href={`/s?i=${d.id}`}
              className="group flex h-full flex-col rounded-[var(--radius-md)] border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-sunk"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-display-sm font-medium text-ink">{d.name}</h2>
                <span className="tnum shrink-0 text-body-sm text-ink-3">{d.count}</span>
              </div>
              <p className="mt-1 text-body-sm text-ink-2">{d.blurb}</p>

              {d.brands.length > 0 && (
                <p className="mt-3 text-body-sm text-ink-3">{d.brands.join(" · ")}</p>
              )}

              <span className="mt-auto inline-flex items-center gap-1 pt-4 text-body-sm font-medium text-brand">
                Shop {d.name}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-[2px]" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
