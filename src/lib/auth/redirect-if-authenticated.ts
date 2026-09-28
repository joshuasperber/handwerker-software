import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-routing";

/** Öffentliche Auth-Seiten: bereits angemeldete Nutzer in ihre Startansicht schicken. */
export async function redirectIfAuthenticated() {
  const session = await getActiveSession();
  if (!session) return;
  redirect(
    getRoleHomePath(session.role, { mustChangePassword: session.mustChangePassword })
  );
}
