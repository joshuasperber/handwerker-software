"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ViewSwitchLink({
  target,
  label,
  className,
  ariaLabel,
}: {
  target: "verwaltung" | "arbeit";
  label: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const textLabel =
    typeof label === "string"
      ? label
      : ariaLabel ??
        (target === "verwaltung" ? "Zur Verwaltung wechseln" : "Zur Arbeit wechseln");

  return (
    <button
      type="button"
      aria-label={textLabel}
      className={cn("text-sm text-[#0d5c63] hover:underline", className)}
      onClick={() => {
        void fetch("/api/app-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ view: target }),
        })
          .then(async (res) => {
            const json = (await res.json().catch(() => null)) as {
              success?: boolean;
              error?: string;
            } | null;
            if (!res.ok || !json?.success) {
              toast.error(json?.error ?? "Ansichtswechsel fehlgeschlagen.");
              return;
            }
            window.location.href = target === "arbeit" ? "/monteur/heute" : "/dashboard";
          })
          .catch(() => {
            toast.error("Ansichtswechsel fehlgeschlagen.");
          });
      }}
    >
      {label}
    </button>
  );
}
