"use server";

import { redirect } from "next/navigation";
import { login, createSession, setSessionCookie } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-routing";

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const tenantSlug = String(formData.get("tenantSlug") ?? "").trim() || DEFAULT_TENANT;

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind Pflicht." };
  }

  const user = await login(email, password, tenantSlug);
  if (!user) {
    return { error: "E-Mail, Passwort oder Betriebs-Kürzel ist falsch." };
  }

  const token = await createSession(user);
  await setSessionCookie(token);

  redirect(
    getRoleHomePath(user.role, { mustChangePassword: user.mustChangePassword })
  );
}
