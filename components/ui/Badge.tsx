import { cn, deliveryDate } from "@/lib/utils";

export type BadgeVariant =
  | "bestSeller"
  | "choice"
  | "deal"
  | "sponsored"
  | "stock"
  | "delivery"
  | "info"
  | "prime";

const VARIANTS: Record<BadgeVariant, string> = {
  bestSeller: "bg-brand [color:var(--color-on-brand)] font-semibold",
  choice: "bg-brand-tint text-brand-ink font-semibold",
  deal: "bg-accent-tint text-accent font-semibold",
  sponsored: "text-ink-3",
  stock: "text-accent",
  delivery: "text-ink-2",
  info: "bg-surface-sunk text-ink border border-line",
  prime: "text-brand-ink font-semibold",
};

const BOXED: BadgeVariant[] = ["bestSeller", "choice", "deal", "info"];

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 text-[11px] leading-4",
        // Only the boxed chips refuse to wrap. The text-only variants are
        // sentences - "Only 2 left in stock - order soon." is wider than a
        // 160px carousel card, so nowrap pushed it straight out of the card and
        // into the one beside it.
        BOXED.includes(variant) && "whitespace-nowrap rounded-[var(--radius-sm)] px-[6px] py-[2px]",
        !BOXED.includes(variant) && "text-[12px]",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/** "Sponsored" with the small info affordance that follows it on result rows. */
export function SponsoredBadge({ className }: { className?: string }) {
  return (
    <Badge variant="sponsored" className={className}>
      Sponsored
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 7v4.5M8 4.8v.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </Badge>
  );
}

/** Red low-stock urgency line. Renders nothing above the threshold. */
export function StockWarning({ stock, threshold = 9 }: { stock: number; threshold?: number }) {
  if (stock > threshold) return null;
  if (stock <= 0) return <Badge variant="stock">Currently unavailable.</Badge>;
  return <Badge variant="stock">Only {stock} left in stock - order soon.</Badge>;
}

/**
 * Delivery promise computed from today, so the store never shows a stale date.
 * The date itself is bold; the rest is muted, matching the reference.
 */
export function DeliveryPromise({
  days,
  free = true,
  className,
}: {
  days: number;
  free?: boolean;
  className?: string;
}) {
  const { long } = deliveryDate(days);
  return (
    <p className={cn("text-[12px] text-muted", className)}>
      {free ? "FREE delivery " : "Delivery "}
      <span className="font-bold text-ink">{long}</span>
    </p>
  );
}

export function PrimeBadge({ className }: { className?: string }) {
  return (
    <Badge variant="prime" className={className}>
      <svg viewBox="0 0 30 12" className="h-3 w-7" aria-hidden>
        <text x="0" y="9.5" fontSize="10" fontWeight="700" fill="currentColor">
          prime
        </text>
      </svg>
    </Badge>
  );
}
