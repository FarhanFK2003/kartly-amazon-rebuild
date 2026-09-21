"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/store/auth";
import { useIsMounted } from "@/lib/store/cart";

const HOVER_BOX =
  "rounded-[2px] border border-transparent px-2 py-1 hover:border-white transition-colors";

/**
 * Header account control.
 *
 * Renders the signed-out greeting on the server and on first paint, then swaps
 * once the persisted session is read. Anything derived from localStorage has to
 * match the server's first render or React reports a hydration mismatch, so the
 * mounted gate is load-bearing rather than defensive.
 */
export function AccountArea({ compact = false }: { compact?: boolean }) {
  const mounted = useIsMounted();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signedIn = mounted && !!user;
  // Preserve where they were, so signing in returns them here.
  const signInHref = pathname && pathname !== "/" ? `/signin?next=${encodeURIComponent(pathname)}` : "/signin";

  if (compact) {
    return signedIn ? (
      <Link href="/orders" className={`${HOVER_BOX} text-[13px] font-bold text-white`}>
        {user!.name.split(" ")[0]}
      </Link>
    ) : (
      <Link href={signInHref} className={`${HOVER_BOX} text-[13px] font-bold text-white`}>
        Sign in
      </Link>
    );
  }

  if (!signedIn) {
    return (
      <Link href={signInHref} className={`${HOVER_BOX} leading-tight`} data-testid="account-area">
        <span className="block text-[12px]">Hello, sign in</span>
        <span className="flex items-center gap-[2px] text-[14px] font-bold leading-[15px]">
          Account &amp; Lists
          <ChevronDown className="h-3 w-3 text-[#ccc]" />
        </span>
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative" data-testid="account-area">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${HOVER_BOX} text-left leading-tight`}
      >
        <span className="block text-[12px]">Hello, {user!.name.split(" ")[0]}</span>
        <span className="flex items-center gap-[2px] text-[14px] font-bold leading-[15px]">
          Account &amp; Lists
          <ChevronDown className={cn("h-3 w-3 text-[#ccc] transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+6px)] z-[70] w-[220px] overflow-hidden rounded-[8px] border border-line bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,.25)]"
        >
          <p className="truncate px-4 py-2 text-[12px] text-muted">{user!.identifier}</p>
          <div className="border-t border-line-soft" />
          <MenuLink href="/orders">Your Orders</MenuLink>
          <MenuLink href="/cart">Your Cart</MenuLink>
          <div className="border-t border-line-soft" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-[14px] text-ink hover:bg-[#f0f2f2]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link role="menuitem" href={href} className="block px-4 py-2 text-[14px] text-ink hover:bg-[#f0f2f2]">
      {children}
    </Link>
  );
}
