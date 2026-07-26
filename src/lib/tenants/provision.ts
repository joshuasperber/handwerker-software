import { prisma } from "@/lib/prisma";
import { ensureOrderTypeDefinitions } from "@/lib/orders/order-types";
import { getOrCreateFinanceSettings } from "@/lib/finance/settings";
import { hashPassword } from "@/lib/auth";
import { createSupabaseAuthUser } from "@/lib/supabase/auth-users";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function ensureUniqueTenantSlug(desired: string): Promise<string> {
  const base = slugify(desired) || "betrieb";
  let slug = base;
  let i = 2;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

export type ProvisionTenantInput = {
  name: string;
  slug?: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  phone?: string | null;
  email?: string | null;
};

export type ProvisionTenantResult =
  | {
      ok: true;
      tenantId: string;
      slug: string;
      userId: string;
      supabaseUserId: string | null;
    }
  | { ok: false; error: string };

/**
 * Creates an empty tenant workspace + ADMIN user (no demo seed data).
 */
export async function provisionEmptyTenant(
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const email = input.adminEmail.toLowerCase().trim();
  const slug = await ensureUniqueTenantSlug(input.slug || input.name);

  const existingUser = await prisma.user.findFirst({
    where: { email },
  });
  if (existingUser) {
    return {
      ok: false,
      error: "Diese E-Mail ist bereits einem Betrieb zugeordnet",
    };
  }

  let supabaseUserId: string | null = null;
  if (isSupabaseAuthConfigured()) {
    const auth = await createSupabaseAuthUser({
      email,
      password: input.adminPassword,
      firstName: input.adminFirstName,
      lastName: input.adminLastName,
    });
    if (!auth.ok) return { ok: false, error: auth.error };
    supabaseUserId = auth.supabaseUserId;
  }

  const passwordHash = await hashPassword(input.adminPassword);

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: input.name.trim(),
      email: input.email?.trim() || email,
      phone: input.phone?.trim() || null,
      users: {
        create: {
          email,
          passwordHash,
          supabaseUserId,
          firstName: input.adminFirstName.trim(),
          lastName: input.adminLastName.trim(),
          role: "ADMIN",
          mustChangePassword: false,
        },
      },
    },
    include: { users: true },
  });

  const admin = tenant.users[0];
  if (!admin) {
    return { ok: false, error: "Admin-Benutzer konnte nicht angelegt werden" };
  }

  await ensureOrderTypeDefinitions(tenant.id);
  await getOrCreateFinanceSettings(tenant.id);

  return {
    ok: true,
    tenantId: tenant.id,
    slug: tenant.slug,
    userId: admin.id,
    supabaseUserId,
  };
}
