"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug: "demo" }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Anmeldung fehlgeschlagen");
        return;
      }

      // Beim ersten Login (Initialpasswort) direkt zur Passwortänderung führen.
      if (data.data?.user?.mustChangePassword) {
        router.push("/dashboard/profil?changePassword=1");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white mb-4">
            <Wrench className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Handwerker App</h1>
          <p className="text-sm text-slate-500 mt-1">Melden Sie sich an</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Anmelden..." : "Anmelden"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Demo: admin@demo.de / demo1234
        </p>
        <p className="mt-2 text-center">
          <Link href="/docs/betriebssystem" className="text-xs text-[#0d5c63] hover:underline">
            Produktkonzept v1.0 lesen →
          </Link>
        </p>
      </Card>
    </div>
  );
}
