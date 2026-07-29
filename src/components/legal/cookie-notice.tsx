"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "jomaster-cookie-notice-v1";

/**
 * Hinweis auf technisch notwendige Session-Cookies.
 * Kein Marketing-/Tracking-Consent — nur Transparenz.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Hinweis zu Cookies"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white p-4 shadow-[0_-4px_24px_rgba(15,23,42,0.08)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Diese Anwendung speichert technisch notwendige Cookies für Anmeldung und Sicherheit
          (Session). Es werden keine Marketing-Cookies gesetzt. Details in der{" "}
          <Link href="/datenschutz" className="text-[#0d5c63] underline underline-offset-2">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Verstanden
        </Button>
      </div>
    </div>
  );
}
