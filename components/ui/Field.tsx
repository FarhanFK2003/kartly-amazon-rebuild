import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

/*
  Form primitives sized and styled for the checkout flow (P0 #8). Inputs use the
  marketplace convention: 1px grey border, inset shadow, and an orange focus glow
  rather than a browser outline.
*/

const CONTROL =
  "w-full rounded-[4px] border border-[#888c8c] bg-white px-3 text-[14px] text-ink " +
  "shadow-[inset_0_1px_2px_rgba(15,17,17,.15)] placeholder:text-faint " +
  "focus:border-[#e77600] focus:shadow-[0_0_3px_2px_rgba(228,121,17,.5)] focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-[#f0f2f2] disabled:text-muted";

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
      className={cn(CONTROL, "h-[34px]", invalid && "border-deal", className)}
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
      className={cn(CONTROL, "h-[34px] cursor-pointer appearance-none bg-[#f0f2f2] pr-8", invalid && "border-deal", className)}
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
