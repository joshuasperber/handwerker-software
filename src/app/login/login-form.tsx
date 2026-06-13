"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginState } from "./actions";

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
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

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Anmelden..." : "Anmelden"}
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
