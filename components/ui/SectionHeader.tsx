import Link from "next/link";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Renders the trailing blue action link, e.g. "See all deals". */
  actionLabel?: string;
  actionHref?: string;
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/* Headings carry the display face; the three roles map to the display scale. */
const SIZES = {
  sm: "text-body-lg",
  md: "text-display-sm",
  lg: "text-display-md",
} as const;

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
  as: Tag = "h2",
  size = "lg",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <Tag className={cn("font-display font-medium leading-tight text-ink", SIZES[size])}>{title}</Tag>
        {subtitle && <p className="mt-1 text-body-sm text-ink-2">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="shrink-0 text-body-sm font-medium text-brand-ink hover:underline">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
