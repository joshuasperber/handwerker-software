import { createSupabaseAdmin } from "./admin";
import { isSupabaseAuthConfigured } from "./env";

export type AuthUserCreateResult =
  | { ok: true; supabaseUserId: string }
  | { ok: false; error: string };

/** Creates (or finds) a Supabase Auth user with email+password. */
export async function createSupabaseAuthUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  emailConfirm?: boolean;
}): Promise<AuthUserCreateResult> {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, error: "Supabase Auth ist nicht konfiguriert" };
  }

  const admin = createSupabaseAdmin();
  const email = input.email.toLowerCase().trim();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: input.emailConfirm ?? true,
    user_metadata: {
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
    },
  });

  if (error) {
    // Already exists — look up by email
    if (/already|registered|exists/i.test(error.message)) {
      const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
      const found = listed.data.users.find(
        (u) => u.email?.toLowerCase() === email
      );
      if (found) {
        await admin.auth.admin.updateUserById(found.id, {
          password: input.password,
          email_confirm: true,
        });
        return { ok: true, supabaseUserId: found.id };
      }
    }
    return { ok: false, error: error.message };
  }

  if (!data.user) return { ok: false, error: "Kein Auth-User zurückgegeben" };
  return { ok: true, supabaseUserId: data.user.id };
}

export async function updateSupabaseAuthPassword(
  supabaseUserId: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, error: "Supabase Auth ist nicht konfiguriert" };
  }
  const admin = createSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(supabaseUserId, {
    password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInWithSupabasePassword(
  email: string,
  password: string
): Promise<
  | { ok: true; supabaseUserId: string }
  | { ok: false; error: string }
> {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, error: "Supabase Auth ist nicht konfiguriert" };
  }

  const admin = createSupabaseAdmin();
  // Prefer admin generateLink / sign-in via password grant through auth API
  const { createClient } = await import("@supabase/supabase-js");
  const { getSupabaseAnonKey, getSupabaseUrl } = await import("./env");
  const anon = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });

  if (error || !data.user) {
    // Fallback: verify user exists and try bcrypt path outside
    void admin;
    return { ok: false, error: error?.message ?? "Anmeldung fehlgeschlagen" };
  }

  return { ok: true, supabaseUserId: data.user.id };
}
