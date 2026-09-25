import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "outline" | "search" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

/*
  Kartly buttons are 8px rounded rectangles, not pills. The pill is one of the
  replica's most recognisable signatures, and dropping it changes the read of
  every screen at no functional cost.

  One filled action per view: brand teal. Everything else is an outline or a
  bare link, so a screen never presents two saturated fills competing for the
  same attention - which is what the yellow-and-orange pair did on the PDP.

  Focus is not defined here. The application-wide :focus-visible ring in
  globals.css covers every interactive element, so a component that styles its
  own focus is creating an inconsistency rather than fixing one.
*/
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand hover:bg-brand-hover border-brand hover:border-brand-hover text-white",
  /* Kept for callers that still ask for a second filled action. It is the same
     brand colour as an outline, not a second hue - retires with the PDP in
     wave 4, where Buy now becomes the outline it should always have been. */
  secondary: "bg-brand-tint hover:bg-[#dbe7e4] border-brand-tint text-brand",
  outline: "bg-surface hover:bg-surface-sunk border-line-strong text-ink",
  search: "bg-brand hover:bg-brand-hover border-brand text-white",
  subtle: "bg-transparent border-transparent text-brand hover:underline",
};

/* Heights clear the 24px minimum target at every size. */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-body-sm",
  md: "h-10 px-4 text-body",
  lg: "h-12 px-5 text-body-lg",
};

function classesFor(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean, className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] border font-medium",
    "transition-colors duration-150 select-none",
    "disabled:cursor-not-allowed disabled:opacity-50",
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
