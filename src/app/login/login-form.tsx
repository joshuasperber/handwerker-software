"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "E-Mail oder Passwort ist falsch.",
  server: "Anmeldung vorübergehend nicht möglich. Bitte später erneut versuchen.",
  rate: "Zu viele Versuche. Bitte kurz warten.",
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full">
        Anmelden
      </Button>

      <p className="text-center text-sm">
        <Link href="/passwort-vergessen" className="text-[#0d5c63] font-medium hover:underline">
          Passwort vergessen?
        </Link>
      </p>

      <p className="text-center text-xs text-slate-400">
        Demo: admin@demo.de / demo1234
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
