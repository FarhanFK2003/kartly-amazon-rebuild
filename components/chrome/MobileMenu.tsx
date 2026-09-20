"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const HELP_LINKS = [
  { label: "Your Account", href: "/signin" },
  { label: "Your Orders", href: "/orders" },
  { label: "Customer Service", href: "/help" },
  { label: "Today's Deals", href: "/s?deals=1" },
];

/**
 * Department drawer, used by both the mobile hamburger and the desktop "All"
 * button. Slides in from the left over a scrim, which is the familiar
 * marketplace pattern and keeps the nav off the critical layout.
 */
export function MobileMenu({ categories, label }: { categories: Category[]; label?: string }) {
  const [open, setOpen] = useState(false);

  // Lock the page behind the drawer, and allow Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open all departments"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1 rounded-[2px] border border-transparent px-2 py-[6px]",
          "text-[14px] font-bold text-white hover:border-white"
        )}
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={2.4} />
        {label && <span>{label}</span>}
      </button>

      {/* scrim */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal={open}
        aria-label="All departments"
        className={cn(
          "fixed inset-y-0 left-0 z-[61] flex w-[85vw] max-w-[365px] flex-col bg-white",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[54px] shrink-0 items-center justify-between bg-subnav px-5 text-white">
          <span className="text-[17px] font-bold">Hello, sign in</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="p-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
          <MenuSection title="Shop by Department">
            {categories.map((c) => (
              <MenuLink key={c.id} href={`/s?i=${c.id}`} onNavigate={() => setOpen(false)}>
                {c.name}
              </MenuLink>
            ))}
          </MenuSection>

          <MenuSection title="Help &amp; Settings">
            {HELP_LINKS.map((l) => (
              <MenuLink key={l.label} href={l.href} onNavigate={() => setOpen(false)}>
                {l.label}
              </MenuLink>
            ))}
          </MenuSection>
        </div>
      </div>
    </>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line-soft py-3">
      <h2 className="px-5 pb-1 pt-2 text-[17px] font-bold text-ink" dangerouslySetInnerHTML={{ __html: title }} />
      <ul>{children}</ul>
    </section>
  );
}

function MenuLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center justify-between px-5 py-[9px] text-[14px] text-ink hover:bg-[#f7fafa]"
      >
        {children}
        <ChevronRight className="h-4 w-4 text-faint" />
      </Link>
    </li>
  );
}
