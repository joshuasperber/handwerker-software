import { Card } from "@/components/ui/card";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { LegalInlineLinks } from "@/components/legal/legal-footer";
import { redirectIfAuthenticated } from "@/lib/auth/redirect-if-authenticated";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  await redirectIfAuthenticated();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f5f7f8] px-4 py-8">
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-96 w-96 -translate-x-1/2 rounded-full bg-[#0b6268]/8 blur-3xl" />
      <Card className="relative w-full max-w-md !p-7 sm:!p-8">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/icons/icon-192.png"
            alt="JoMaster Logo"
            width={48}
            height={48}
            className="mb-4 h-14 w-14 rounded-[18px] shadow-[0_12px_34px_rgba(11,98,104,0.2)] ring-1 ring-white"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Willkommen zurück</h1>
          <p className="mt-1 text-sm text-slate-500">Melden Sie sich bei JoMaster an</p>
        </div>

        <LoginForm errorCode={error} />
      </Card>
      <LegalInlineLinks className="mt-6" />
    </div>
  );
}
