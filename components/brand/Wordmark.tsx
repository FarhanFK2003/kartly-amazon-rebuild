import { cn } from "@/lib/utils";

/**
 * Kartly's own wordmark: a lowercase logotype with an amber arc sweeping left to
 * right beneath it. It borrows the marketplace convention of a warm accent mark
 * under a lowercase name without reproducing anyone else's logo.
 *
 * Drawn as inline SVG so it stays crisp at any size and inherits the page font.
 */
export function Wordmark({
  height = 30,
  className,
  accent = "#ff9900",
}: {
  height?: number;
  className?: string;
  accent?: string;
}) {
  return (
    <svg
      viewBox="0 0 124 44"
      height={height}
      width={(124 / 44) * height}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label="Kartly"
    >
      <text
        x="0"
        y="29"
        fontSize="31"
        fontWeight="700"
        letterSpacing="-1"
        fill="currentColor"
        fontFamily="inherit"
      >
        kartly
      </text>
      {/* the sweep */}
      <path
        d="M3 35.5 Q46 43.5 104 33"
        fill="none"
        stroke={accent}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* arrow tip, angled along the curve */}
      <path d="M99 28.4 L109.5 32.2 L100.8 38.4 Z" fill={accent} />
    </svg>
  );
}
