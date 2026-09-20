import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "outline" | "search" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

/*
  Marketplace buttons are pills with a 1px darker border and a soft inner
  highlight. The yellow primary and orange secondary are the two CTAs that carry
  the whole buy flow, so they are defined once here and never restyled inline.
*/
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-cta hover:bg-cta-hover border-cta-border text-ink shadow-[0_2px_5px_rgba(213,217,217,.5)]",
  secondary:
    "bg-buy hover:bg-buy-hover border-buy-border text-ink shadow-[0_2px_5px_rgba(213,217,217,.5)]",
  outline:
    "bg-white hover:bg-[#f7fafa] border-line text-ink shadow-[0_2px_5px_rgba(213,217,217,.5)]",
  search: "bg-search hover:bg-search-hover border-search text-ink",
  subtle: "bg-transparent border-transparent text-link hover:underline shadow-none",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-3 text-[12px]",
  md: "h-8 px-4 text-[13px]",
  lg: "h-11 px-5 text-[15px]",
};

function classesFor(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean, className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full border font-normal",
    "transition-colors select-none",
    "active:shadow-[inset_0_2px_3px_rgba(0,0,0,.18)]",
    "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={classesFor(variant, size, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** Same skin as Button, but renders a real link so it is navigable and crawlable. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={classesFor(variant, size, fullWidth, className)} {...props}>
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
