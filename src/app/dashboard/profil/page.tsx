"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/utils";
import { saveJson } from "@/lib/save-toast";
import { fetchJson } from "@/lib/fetch-json";
import { AlertTriangle, ShieldCheck, Upload, X } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
  role: string;
  mustChangePassword: boolean;
}

const MAX_AVATAR_DIMENSION = 256;

/** Liest ein Bild ein und skaliert es client-seitig zu einer kleinen Data-URL. */
function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.onload = () => {
        const scale = Math.min(
          1,
          MAX_AVATAR_DIMENSION / Math.max(img.width, img.height)
        );
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas nicht verfügbar"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    avatarUrl: null as string | null,
  });

  const [pw, setPw] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [pwError, setPwError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const forcedChange = searchParams.get("changePassword") === "1";

  useEffect(() => {
    fetchJson<Profile>("/api/profile").then((res) => {
      if (res.success && res.data) {
        setProfile(res.data);
        setForm({
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          email: res.data.email,
          phone: res.data.phone ?? "",
          address: res.data.address ?? "",
          avatarUrl: res.data.avatarUrl,
        });
      }
      setLoading(false);
    });
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte eine Bilddatei auswählen");
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setForm((f) => ({ ...f, avatarUrl: dataUrl }));
    } catch {
      toast.error("Bild konnte nicht verarbeitet werden");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const data = await saveJson<Profile>(
      "/api/profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          address: form.address,
          avatarUrl: form.avatarUrl,
        }),
      },
      { success: "Profil gespeichert" }
    );
    if (data.success && data.data) {
      setProfile(data.data);
      router.refresh();
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");

    if (!pw.newPassword) {
      setPwError("Neues Passwort darf nicht leer sein");
      return;
    }
    if (pw.newPassword !== pw.confirmPassword) {
      setPwError("Die neuen Passwörter stimmen nicht überein");
      return;
    }

    const data = await saveJson(
      "/api/profile/password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pw),
      },
      { success: "Passwort geändert" }
    );

    if (data.success) {
      setPw({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setProfile((p) => (p ? { ...p, mustChangePassword: false } : p));
      router.refresh();
    } else {
      setPwError(data.error ?? "Passwort konnte nicht geändert werden");
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Profil wird geladen …</p>;
  }
  if (!profile) {
    return <p className="text-sm text-red-600">Profil konnte nicht geladen werden.</p>;
  }

  const initials =
    (form.firstName.charAt(0) + form.lastName.charAt(0)).toUpperCase() || "?";
  const mustChange = profile.mustChangePassword || forcedChange;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mein Profil</h1>

      {mustChange && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Bitte ändern Sie Ihr Initialpasswort</p>
            <p className="text-sm">
              Sie melden sich noch mit dem vergebenen Initialpasswort an. Vergeben Sie
              unten ein eigenes, sicheres Passwort.
            </p>
          </div>
        </div>
      )}

      {/* Persönliche Daten */}
      <Card title="Persönliche Daten">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              {form.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.avatarUrl}
                  alt="Profilbild"
                  className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0d5c63] text-2xl font-semibold text-white">
                  {initials}
                </div>
              )}
              {form.avatarUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, avatarUrl: null }))}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 hover:text-red-600"
                  aria-label="Profilbild entfernen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" /> Profilbild wählen
              </Button>
              <p className="mt-1 text-xs text-slate-400">Optional · JPG/PNG</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Vorname *"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Input
              label="Nachname *"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
            <Input
              label="E-Mail *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Telefon"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Adresse"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Rolle</label>
              <div className="mt-1 flex h-8 items-center gap-2 rounded-lg border border-input bg-slate-50 px-2.5 text-sm text-slate-600">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                {ROLE_LABELS[profile.role] ?? profile.role}
                <span className="text-xs text-slate-400">(nur Administrator änderbar)</span>
              </div>
            </div>
          </div>

          <Button type="submit" variant="action">Speichern</Button>
        </form>
      </Card>

      {/* Passwort ändern */}
      <Card title="Passwort ändern">
        <form onSubmit={changePassword} className="space-y-4">
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          <Input
            label="Aktuelles Passwort *"
            type="password"
            value={pw.oldPassword}
            onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })}
            autoComplete="current-password"
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Neues Passwort *"
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              autoComplete="new-password"
              required
            />
            <Input
              label="Neues Passwort bestätigen *"
              type="password"
              value={pw.confirmPassword}
              onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
              autoComplete="new-password"
              required
            />
          </div>
          <p className="text-xs text-slate-400">Mindestens 6 Zeichen.</p>
          <Button type="submit" variant="action">Passwort ändern</Button>
        </form>
      </Card>
    </div>
  );
}
