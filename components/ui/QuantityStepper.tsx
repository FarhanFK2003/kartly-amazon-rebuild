"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Called instead of decrementing when value is at min. */
  onRemove?: () => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Replaces the bare number in the middle, e.g. "2 in cart". */
  label?: string;
  /** Stretches to the width of its container, for use in place of a button. */
  fullWidth?: boolean;
  /** Test-id from lib/testids. */
  testId?: string;
  className?: string;
}

/**
 * The cart stepper swaps its decrement control for a delete affordance at the
 * minimum, which is the behaviour shoppers expect: stepping below one means
 * "remove this", not "nothing happens".
 */
export function QuantityStepper({
  value,
  onChange,
  onRemove,
  min = 1,
  max = 30,
  disabled = false,
  size = "md",
  label,
  fullWidth = false,
  testId,
  className,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const removable = atMin && typeof onRemove === "function";

  const box = size === "sm" ? "h-8 text-body-sm" : "h-10 text-body";
  const btn = size === "sm" ? "w-8" : "w-10";

  return (
    <div
      data-testid={testId}
      className={cn(
        "inline-flex items-center rounded-[var(--radius-btn)] border border-line-strong bg-surface",
        disabled && "opacity-55",
        fullWidth && "flex w-full",
        box,
        className
      )}
    >
      <button
        type="button"
        onClick={() => (removable ? onRemove!() : onChange(value - 1))}
        disabled={disabled || (atMin && !removable)}
        aria-label={removable ? "Remove item" : "Decrease quantity"}
        className={cn(
          "flex h-full items-center justify-center rounded-l-[var(--radius-btn)] text-ink",
          "hover:bg-surface-sunk disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent",
          btn
        )}
      >
        {removable ? <Trash2 className="h-[15px] w-[15px]" /> : <Minus className="h-[15px] w-[15px]" />}
      </button>

      <span
        className={cn(
          "tnum select-none border-x border-line px-1 text-center font-medium leading-none",
          label ? "flex-1 whitespace-nowrap" : "min-w-[28px]"
        )}
        aria-live="polite"
      >
        {label ?? value}
      </span>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || atMax}
        aria-label="Increase quantity"
        className={cn(
          "flex h-full items-center justify-center rounded-r-[var(--radius-btn)] text-ink",
          "hover:bg-surface-sunk disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent",
          btn
        )}
      >
        <Plus className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
