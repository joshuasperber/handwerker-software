import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SessionProvider } from "@/components/auth/can-access";
import { getRoleHomePath } from "@/lib/permissions";
import { PortalNav } from "@/components/portal/portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "GAST") redirect(getRoleHomePath(session.role));

  return (
    <SessionProvider user={session}>
      <div className="min-h-screen bg-[#f8fafb]">
        <PortalNav name={`${session.firstName} ${session.lastName}`} />
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </div>
    </SessionProvider>
  );
}
