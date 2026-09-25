import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

/*
  Form primitives sized and styled for the checkout flow (P0 #8). Inputs use the
  marketplace convention: 1px grey border, inset shadow, and an orange focus glow
  rather than a browser outline.
*/

/*
  One control skin for inputs, selects and textareas.

  No inset shadow and no bespoke focus glow: separation comes from the border,
  and focus comes from the application-wide :focus-visible ring, so a field
  cannot drift out of step with a button.
*/
const CONTROL =
  "w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-body text-ink " +
  "placeholder:text-ink-3 transition-colors duration-150 " +
  "hover:border-ink-3 focus:border-brand " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunk disabled:text-ink-3";

interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-bold text-ink">
          {label}
          {required && <span className="ml-1 text-deal">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[12px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-[12px] text-deal">
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(CONTROL, "h-10", invalid && "border-accent", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      // No grey fill: #f0f2f2 is the disabled background this same base class
      // sets, so an enabled select was wearing the app's disabled colour - most
      // visibly in the checkout address row, where State sat between two white
      // inputs and read as switched off.
      className={cn(CONTROL, "h-10 cursor-pointer appearance-none pr-8", invalid && "border-accent", className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2 text-[13px] text-ink", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-[2px] h-[14px] w-[14px] shrink-0 cursor-pointer accent-[#007185]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
