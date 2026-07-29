"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "E-Mail oder Passwort ist falsch.",
  server: "Anmeldung vorübergehend nicht möglich. Bitte später erneut versuchen.",
  rate: "Zu viele Versuche. Bitte kurz warten.",
};

type LoginResponse = {
  success: boolean;
  error?: string;
  data?: {
    user: { role: string; mustChangePassword?: boolean };
    redirectTo?: string;
  };
};

export function LoginForm({ errorCode }: { errorCode?: string }) {
  const [error, setError] = useState(
    errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.invalid : undefined
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });

      const json = (await res.json().catch(() => null)) as LoginResponse | null;

      if (!res.ok || !json?.success) {
        if (res.status === 429) {
          setError(ERROR_MESSAGES.rate);
        } else if (res.status >= 500) {
          setError(json?.error ?? ERROR_MESSAGES.server);
        } else {
          setError(json?.error ?? ERROR_MESSAGES.invalid);
        }
        setPending(false);
        return;
      }

      // Hard navigation: Cookie ist gesetzt, keine doppelte Soft-Navigation
      const target = json.data?.redirectTo ?? "/dashboard";
      window.location.assign(target);
    } catch {
      setError(ERROR_MESSAGES.server);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label="E-Mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        disabled={pending}
      />
      <Input
        label="Passwort"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        disabled={pending}
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Anmelden…" : "Anmelden"}
      </Button>

      <p className="text-center text-sm">
        <Link href="/passwort-vergessen" className="text-[#0d5c63] font-medium hover:underline">
          Passwort vergessen?
        </Link>
      </p>

      <p className="text-center text-sm text-slate-600">
        Noch keinen Betrieb?{" "}
        <Link href="/registrieren" className="text-[#0d5c63] font-medium hover:underline">
          JoMaster starten
        </Link>
      </p>
    </form>
  );
}
