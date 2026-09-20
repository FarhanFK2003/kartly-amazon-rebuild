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

const SIZES = {
  sm: "text-[15px]",
  md: "text-[18px]",
  lg: "text-[21px]",
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
        <Tag className={cn("font-bold leading-tight text-ink", SIZES[size])}>{title}</Tag>
        {subtitle && <p className="mt-[2px] text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="link shrink-0 text-[13px]">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
