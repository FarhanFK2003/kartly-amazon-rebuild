"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One checkout step.
 *
 * Completed steps collapse to a one-line summary with a Change link, which
 * lets the shopper see the whole order taking shape without scrolling three
 * open forms. That behaviour is unchanged; only the chrome moved onto the
 * Kartly system - hairline separation instead of stacked boxes, and a step
 * marker that reads as state rather than a numbered badge.
 *
 * Completion is not signalled by colour alone: a finished step shows a tick,
 * and its summary text states what was entered.
 */
export function CheckoutStepPanel({
  number,
  title,
  state,
  summary,
  onEdit,
  children,
}: {
  number: number;
  title: string;
  state: "active" | "complete" | "upcoming";
  summary?: React.ReactNode;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  const complete = state === "complete";

  return (
    <section
      className={cn(
        "border-t border-line py-6 first:border-t-0 first:pt-0",
        state === "upcoming" && "opacity-55"
      )}
      aria-current={state === "active" ? "step" : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-label font-semibold",
            complete
              ? "bg-success text-white"
              : state === "active"
                ? "bg-brand text-white"
                : "border border-line-strong bg-surface text-ink-3"
          )}
          aria-hidden
        >
          {complete ? <Check className="h-4 w-4" /> : number}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className={cn(
                "font-display text-display-sm font-medium",
                state === "upcoming" ? "text-ink-3" : "text-ink"
              )}
            >
              {title}
            </h2>
            {complete && onEdit && (
              <button type="button" onClick={onEdit} className="text-body-sm font-medium text-brand hover:underline">
                Change
              </button>
            )}
          </div>

          {complete && summary && <div className="mt-1 text-body-sm text-ink-2">{summary}</div>}
        </div>
      </div>

      {state === "active" && children && (
        <div className="border-t border-line-soft px-4 py-4 sm:px-5">{children}</div>
      )}
    </section>
  );
}
