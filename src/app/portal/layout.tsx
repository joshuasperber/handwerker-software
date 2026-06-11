import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SessionProvider } from "@/components/auth/can-access";
import { PortalNav } from "@/components/portal/portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Nur eingeladene Gäste nutzen das Portal; andere Rollen ins Dashboard.
  if (session.role !== "GAST") redirect("/dashboard");

  return (
    <SessionProvider user={session}>
      <div className="min-h-screen bg-[#f8fafb]">
        <PortalNav name={`${session.firstName} ${session.lastName}`} />
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </div>
    </SessionProvider>
  );
}
