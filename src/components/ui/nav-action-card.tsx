"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mobilfreundlicher Navigations-Button statt „Text →“. */
export function NavActionCard({
  href,
  title,
  description,
  icon: Icon,
  className,
}: {
  href: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5",
        "shadow-[0_1px_2px_rgba(15,23,42,0.03),0_8px_24px_rgba(15,23,42,0.04)] transition-[transform,background-color,box-shadow,border-color] duration-150",
        "hover:-translate-y-0.5 hover:border-[#0b6268]/25 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] active:translate-y-0 active:scale-[0.98] active:bg-slate-50",
        "touch-manipulation min-h-12",
        className
      )}
    >
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b6268]/9 text-[#0b6268]">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#0b6268]" />
    </Link>
  );
}
