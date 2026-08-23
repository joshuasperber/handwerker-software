import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth-session";
import { getAppReturnLabel, getRoleHomePath } from "@/lib/role-routing";
import { Button } from "@/components/ui/button";

export async function PublicSiteHeader({
  showRegister = false,
  narrow = false,
}: {
  showRegister?: boolean;
  narrow?: boolean;
}) {
  const session = await getSession();
  const homeHref = session
    ? getRoleHomePath(session.role, { mustChangePassword: session.mustChangePassword })
    : "/";
  const returnLabel = session ? getAppReturnLabel(session.role) : null;

  return (
    <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex items-center justify-between px-4 py-4 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}>
        <Link href={homeHref} className="flex items-center gap-2">
          <Image
            src="/icons/icon-192.png"
            alt="JoMaster Logo"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg"
          />
          <span className="text-lg font-bold text-slate-900">JoMaster</span>
        </Link>
        <div className="flex items-center gap-3">
          {session ? (
            <Button asChild size="sm">
              <Link href={homeHref}>{returnLabel}</Link>
            </Button>
          ) : (
            <>
              {showRegister ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/registrieren">Betrieb anlegen</Link>
                </Button>
              ) : null}
              <Button asChild size="sm">
                <Link href="/login">Anmelden</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
