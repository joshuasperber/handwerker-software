import { Card } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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

        <LoginForm errorCode={error} />
      </Card>
    </div>
  );
}
