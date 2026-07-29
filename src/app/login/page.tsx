import { Card } from "@/components/ui/card";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { LegalInlineLinks } from "@/components/legal/legal-footer";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/icons/icon-192.png"
            alt="JoMaster Logo"
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl mb-4"
          />
          <h1 className="text-2xl font-bold text-slate-900">JoMaster</h1>
          <p className="text-sm text-slate-500 mt-1">Melden Sie sich an</p>
        </div>

        <LoginForm errorCode={error} />
      </Card>
      <LegalInlineLinks className="mt-6" />
    </div>
  );
}
