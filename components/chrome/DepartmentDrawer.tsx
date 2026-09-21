"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavDrawer } from "@/lib/store/navDrawer";
import { useAuth } from "@/lib/store/auth";
import { useIsMounted } from "@/lib/store/cart";
import type { NavDepartment, NavGroup } from "@/lib/navigation";

/**
 * The department drawer.
 *
 * Rendered exactly once, by SiteHeader. Both triggers (the mobile hamburger and
 * the desktop "All" button) drive it through a shared store, so there is one
 * dialog and one scrim in the accessibility tree rather than a hidden duplicate
 * of each. It is the same drawer at every width - only its width changes -
 * which is also how the reference marketplace behaves.
 *
 * Modal semantics: aria-modal, focus moved in on open, Tab cycled within,
 * Escape and outside-click to dismiss, and focus returned to whichever trigger
 * opened it.
 */
export function DepartmentDrawer({
  departments,
  groups,
}: {
  departments: NavDepartment[];
  groups: NavGroup[];
}) {
  const open = useNavDrawer((s) => s.open);
  const close = useNavDrawer((s) => s.closeDrawer);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const mounted = useIsMounted();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const signedIn = mounted && !!user;

  const pathname = usePathname();
  const params = useSearchParams();
  const activeDepartment = pathname === "/s" ? params.get("i") : null;

  /* focus management, body lock, Escape */
  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Let the panel paint before moving focus, or the browser scrolls to it.
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      // Keep Tab inside the dialog while it is modal.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, close]);

  // Close on navigation, so following a link never leaves the drawer open.
  useEffect(() => {
    close();
  }, [pathname, params, close]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Shop by department"
        aria-hidden={!open || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-[61] flex w-[86vw] max-w-[340px] flex-col bg-white",
          "transition-transform duration-200 ease-out lg:max-w-[380px]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* header */}
        <div className="flex h-[54px] shrink-0 items-center justify-between bg-subnav pl-5 pr-2 text-white">
          <span className="truncate text-[17px] font-bold">
            {signedIn ? `Hello, ${user!.name.split(" ")[0]}` : "Hello, sign in"}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close department menu"
            className="rounded p-2 hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
          <Section title="Shop by Department">
            <ul>
              {departments.map((d) => {
                const isOpen = expanded === d.id;
                const isActive = activeDepartment === d.id;
                return (
                  <li key={d.id} className="border-b border-line-soft last:border-0">
                    <div className="flex items-stretch">
                      <Link
                        href={`/s?i=${d.id}`}
                        tabIndex={open ? 0 : -1}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "min-w-0 flex-1 px-5 py-[9px] text-[14px] hover:bg-[#f0f2f2] focus-visible:bg-[#f0f2f2]",
                          isActive ? "font-bold text-link" : "text-ink"
                        )}
                      >
                        <span className="truncate">{d.name}</span>
                        <span className="ml-2 text-[12px] text-muted">({d.count})</span>
                      </Link>

                      <button
                        type="button"
                        tabIndex={open ? 0 : -1}
                        onClick={() => setExpanded(isOpen ? null : d.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} brands in ${d.name}`}
                        className="flex w-11 shrink-0 items-center justify-center text-muted hover:bg-[#f0f2f2] hover:text-ink"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>

                    {isOpen && (
                      <ul className="bg-[#f7f8f8] pb-2">
                        <li>
                          <Link
                            href={`/s?i=${d.id}`}
                            tabIndex={open ? 0 : -1}
                            className="block px-8 py-[7px] text-[13px] font-bold text-link hover:underline"
                          >
                            Shop all {d.name}
                          </Link>
                        </li>
                        {d.brands.map((brand) => (
                          <li key={brand}>
                            <Link
                              href={`/s?i=${d.id}&brand=${encodeURIComponent(brand)}`}
                              tabIndex={open ? 0 : -1}
                              className="block px-8 py-[7px] text-[13px] text-ink hover:text-link-hover hover:underline"
                            >
                              {brand}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          {groups.map((group) => (
            <Section key={group.title} title={group.title}>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      tabIndex={open ? 0 : -1}
                      className="block px-5 py-[9px] text-[14px] text-ink hover:bg-[#f0f2f2] focus-visible:bg-[#f0f2f2]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ))}

          <Section title="Account">
            <ul>
              {signedIn ? (
                <li>
                  <button
                    type="button"
                    tabIndex={open ? 0 : -1}
                    onClick={() => {
                      signOut();
                      close();
                    }}
                    className="block w-full px-5 py-[9px] text-left text-[14px] text-ink hover:bg-[#f0f2f2]"
                  >
                    Sign out
                  </button>
                </li>
              ) : (
                <li>
                  <Link
                    href="/signin"
                    tabIndex={open ? 0 : -1}
                    className="block px-5 py-[9px] text-[14px] text-ink hover:bg-[#f0f2f2]"
                  >
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </Section>

          <p className="px-5 pt-4 text-[12px] leading-4 text-muted">
            Kartly is a demo storefront. Every link here leads to real catalogue results.
          </p>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-2 last:border-0">
      <h2 className="px-5 pb-1 pt-2 text-[16px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
