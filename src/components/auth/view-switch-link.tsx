"use client";

import { cn } from "@/lib/utils";

export function ViewSwitchLink({
  target,
  label,
  className,
}: {
  target: "verwaltung" | "arbeit";
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("text-sm text-[#0d5c63] hover:underline", className)}
      onClick={() => {
        void fetch("/api/app-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ view: target }),
        }).then(() => {
          window.location.href = target === "arbeit" ? "/monteur/heute" : "/dashboard";
        });
      }}
    >
      {label}
    </button>
  );
}
