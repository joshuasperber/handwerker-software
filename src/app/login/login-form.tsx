"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "E-Mail, Passwort oder Betriebs-Kürzel ist falsch.",
  server: "Anmeldung vorübergehend nicht möglich. Bitte später erneut versuchen.",
};

export function LoginForm({ errorCode }: { errorCode?: string }) {
  const error = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.invalid : undefined;

  return (
    <form action="/api/auth/login" method="POST" className="space-y-4">
      <Input
        label="E-Mail"
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      <Input
        label="Passwort"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />
      <input type="hidden" name="tenantSlug" value={DEFAULT_TENANT} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full">
        Anmelden
      </Button>

      <p className="text-center text-xs text-slate-400">
        Demo: admin@demo.de / demo1234
      </p>
      <p className="text-center">
        <Link href="/docs/betriebssystem" className="text-xs text-[#0d5c63] hover:underline">
          Produktkonzept v1.0 lesen →
        </Link>
      </p>
    </form>
  );
}
