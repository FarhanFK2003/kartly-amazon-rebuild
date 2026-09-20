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
  className,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const removable = atMin && typeof onRemove === "function";

  const box = size === "sm" ? "h-7 text-[12px]" : "h-8 text-[13px]";
  const btn = size === "sm" ? "w-7" : "w-8";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-[#d5d9d9] bg-white",
        "shadow-[0_2px_5px_rgba(213,217,217,.5)]",
        disabled && "opacity-55",
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
          "flex h-full items-center justify-center rounded-l-full text-ink",
          "hover:bg-[#f7fafa] disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent",
          btn
        )}
      >
        {removable ? <Trash2 className="h-[15px] w-[15px]" /> : <Minus className="h-[15px] w-[15px]" />}
      </button>

      <span
        className="min-w-[28px] select-none border-x border-line px-1 text-center font-medium leading-none"
        aria-live="polite"
      >
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || atMax}
        aria-label="Increase quantity"
        className={cn(
          "flex h-full items-center justify-center rounded-r-full text-ink",
          "hover:bg-[#f7fafa] disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent",
          btn
        )}
      >
        <Plus className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
