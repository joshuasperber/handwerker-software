"use client";

import { useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
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
  const [isPending, setIsPending] = useState(false);
  const textLabel =
    typeof label === "string"
      ? label
      : ariaLabel ??
        (target === "verwaltung" ? "Zur Verwaltung wechseln" : "Zur Arbeit wechseln");

  return (
    <button
      type="button"
      aria-label={textLabel}
      aria-busy={isPending}
      disabled={isPending}
      className={cn("relative text-sm text-[#0d5c63] hover:underline disabled:cursor-wait", className)}
      onClick={() => {
        setIsPending(true);
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
              setIsPending(false);
              return;
            }
            window.location.href = target === "arbeit" ? "/monteur/heute" : "/dashboard";
          })
          .catch(() => {
            toast.error("Ansichtswechsel fehlgeschlagen.");
            setIsPending(false);
          });
      }}
    >
      <span className={cn("contents", isPending && "invisible")}>{label}</span>
      {isPending && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <LoaderCircle className="h-4 w-4 animate-spin" />
        </span>
      )}
    </button>
  );
}
