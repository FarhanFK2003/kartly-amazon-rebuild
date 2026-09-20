"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accordion step. Completed steps collapse to a one-line summary with a Change
 * link, which is what lets the shopper see the whole order taking shape without
 * scrolling through three open forms.
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
        "rounded-[8px] border bg-white",
        state === "active" ? "border-line shadow-[0_2px_5px_rgba(15,17,17,.08)]" : "border-line-soft"
      )}
      aria-current={state === "active" ? "step" : undefined}
    >
      <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
        <span
          className={cn(
            "mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
            complete ? "bg-success text-white" : state === "active" ? "bg-subnav text-white" : "bg-[#e3e6e6] text-muted"
          )}
          aria-hidden
        >
          {complete ? <Check className="h-4 w-4" /> : number}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className={cn(
                "text-[18px] font-bold",
                state === "upcoming" ? "text-muted" : "text-ink"
              )}
            >
              {title}
            </h2>
            {complete && onEdit && (
              <button type="button" onClick={onEdit} className="link text-[13px]">
                Change
              </button>
            )}
          </div>

          {complete && summary && <div className="mt-1 text-[13px] text-muted">{summary}</div>}
        </div>
      </div>

      {state === "active" && children && (
        <div className="border-t border-line-soft px-4 py-4 sm:px-5">{children}</div>
      )}
    </section>
  );
}
