"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavDrawer } from "@/lib/store/navDrawer";

/**
 * Opens the single department drawer. Rendered twice - once in the mobile row,
 * once in the desktop subnav - but both instances drive the same dialog, so the
 * duplication is two buttons rather than two dialogs.
 */
export function DrawerTrigger({
  label,
  ariaLabel,
  className,
}: {
  label?: string;
  ariaLabel: string;
  className?: string;
}) {
  const open = useNavDrawer((s) => s.open);
  const openDrawer = useNavDrawer((s) => s.openDrawer);

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn(
        "flex items-center gap-1 rounded-[2px] border border-transparent px-2 py-[6px]",
        "text-[14px] font-bold text-white hover:border-white",
        className
      )}
    >
      <Menu className="h-[18px] w-[18px]" strokeWidth={2.4} />
      {label && <span>{label}</span>}
    </button>
  );
}
