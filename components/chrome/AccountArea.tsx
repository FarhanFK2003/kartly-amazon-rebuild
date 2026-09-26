"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, User } from "lucide-react";
import { cn, CURRENCY } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { useAuth, type AuthUser } from "@/lib/store/auth";

/**
 * Account control.
 *
 * The signed-in state is resolved on the server from the session cookie and
 * passed in, so the header is correct on first paint - there is no flash of
 * "Sign in" for someone who is already signed in, and no mount gate is needed
 * for it. The server and the first client render read the same prop, so there
 * is nothing for React to mismatch.
 *
 * The locale line moved in here from its own header control. Kartly ships one
 * locale and one currency, so a dedicated slot in the bar was spending standing
 * chrome to state a fact that never changes. It is stated here instead, where
 * someone looking for account settings would actually look for it.
 *
 * Signed-in state comes from the server session, loaded once after mount.
 */
export function AccountArea({
  compact = false,
  user: initialUser = null,
}: {
  compact?: boolean;
  /** Read from the session cookie on the server, so first paint is correct. */
  user?: AuthUser | null;
}) {
  const storeUser = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const signOut = useAuth((s) => s.signOut);

  /*
    The server already resolved the session, so this renders the right state
    immediately. The store only takes over once it has its own answer - after a
    sign-out on this page, for instance. It is not seeded directly because the
    store is module scope, which on the server is shared between requests.
  */
  const user = ready ? storeUser : initialUser;
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signedIn = !!user;
  // Preserve where they were, so signing in returns them here.
  const signInHref =
    pathname && pathname !== "/" ? `/signin?next=${encodeURIComponent(pathname)}` : "/signin";

  /* The part of the address before the @ is the closest thing to a name the
     account has, and it is what a shopper recognises as theirs. */
  const accountLabel = user ? user.email.split("@")[0] : "";

  if (compact) {
    return (
      <Link
        href={signedIn ? "/orders" : signInHref}
        data-testid={TID.accountArea}
        className="flex h-10 items-center rounded-[var(--radius-sm)] px-2 text-body font-medium text-ink transition-colors hover:bg-surface-sunk"
      >
        {signedIn ? accountLabel : "Sign in"}
      </Link>
    );
  }

  if (!signedIn) {
    return (
      <Link
        href={signInHref}
        data-testid={TID.accountArea}
        className="flex h-9 items-center gap-[6px] rounded-[var(--radius-sm)] px-3 text-body font-medium text-ink transition-colors hover:bg-surface-sunk"
      >
        <User className="h-4 w-4" aria-hidden />
        Sign in
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative" data-testid={TID.accountArea}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex h-9 items-center gap-[6px] rounded-[var(--radius-sm)] px-3 text-body font-medium text-ink",
          "transition-colors hover:bg-surface-sunk",
          open && "bg-surface-sunk"
        )}
      >
        <User className="h-4 w-4" aria-hidden />
        {accountLabel}
        <ChevronDown className={cn("h-4 w-4 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[240px] overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[var(--shadow-overlay)]"
        >
          <p className="truncate px-4 py-2 text-body-sm text-ink-3">{user!.email}</p>
          <div className="border-t border-line" />
          <MenuLink href="/account">Your Account</MenuLink>
          <MenuLink href="/orders">Your Orders</MenuLink>
          <MenuLink href="/cart">Your Cart</MenuLink>
          <MenuLink href="/help">Help Centre</MenuLink>
          <div className="border-t border-line" />
          <p className="px-4 py-2 text-body-sm text-ink-3">
            English &middot; {CURRENCY.symbol} {CURRENCY.code}
          </p>
          <div className="border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-body text-ink transition-colors hover:bg-surface-sunk"
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
    <Link
      role="menuitem"
      href={href}
      className="block px-4 py-2 text-body text-ink transition-colors hover:bg-surface-sunk"
    >
      {children}
    </Link>
  );
}
