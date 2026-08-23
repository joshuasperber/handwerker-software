import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { getRoleHomePath } from "@/lib/role-routing";

/** Öffentliche Auth-Seiten: bereits angemeldete Nutzer in ihre Startansicht schicken. */
export async function redirectIfAuthenticated() {
  const session = await getSession();
  if (!session) return;
  redirect(
    getRoleHomePath(session.role, { mustChangePassword: session.mustChangePassword })
  );
}
