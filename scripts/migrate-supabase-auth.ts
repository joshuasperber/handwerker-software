/**
 * Restores admin@demo.de and migrates existing Prisma users into Supabase Auth.
 *
 * Usage:
 *   npm run auth:migrate
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (or PUBLISHABLE_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DATABASE_URL
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { createSupabaseAuthUser } from "../src/lib/supabase/auth-users";
import { isSupabaseAuthConfigured } from "../src/lib/supabase/env";
import { ensureOrderTypeDefinitions } from "../src/lib/orders/order-types";
import { getOrCreateFinanceSettings } from "../src/lib/finance/settings";

const DEMO_ADMIN_EMAIL = "admin@demo.de";
const DEMO_ADMIN_PASSWORD = "demo1234";

async function ensureDemoTenant() {
  let tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: "demo",
        name: "Mustermann Sanitär GmbH",
        email: "info@demo.de",
      },
    });
    console.log("Created demo tenant");
  }
  await ensureOrderTypeDefinitions(tenant.id);
  await getOrCreateFinanceSettings(tenant.id);
  return tenant;
}

async function restoreDemoAdmin(tenantId: string) {
  const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);
  let supabaseUserId: string | null = null;

  if (isSupabaseAuthConfigured()) {
    const auth = await createSupabaseAuthUser({
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      firstName: "Admin",
      lastName: "Demo",
    });
    if (!auth.ok) {
      console.error("Supabase admin create failed:", auth.error);
    } else {
      supabaseUserId = auth.supabaseUserId;
      console.log("Supabase Auth user ready:", DEMO_ADMIN_EMAIL);
    }
  } else {
    console.warn(
      "Supabase Auth keys missing — admin restored only in Prisma (bcrypt fallback)."
    );
  }

  const existing = await prisma.user.findFirst({
    where: { tenantId, email: DEMO_ADMIN_EMAIL },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        supabaseUserId: supabaseUserId ?? existing.supabaseUserId,
        role: "ADMIN",
        isActive: true,
        mustChangePassword: false,
        firstName: existing.firstName || "Admin",
        lastName: existing.lastName || "Demo",
      },
    });
    console.log("Updated Prisma admin:", DEMO_ADMIN_EMAIL);
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      tenantId,
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      supabaseUserId,
      firstName: "Admin",
      lastName: "Demo",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log("Created Prisma admin:", DEMO_ADMIN_EMAIL);
  return created.id;
}

async function migrateExistingUsers(defaultPassword = "ChangeMe123!") {
  if (!isSupabaseAuthConfigured()) {
    console.warn("Skip user migration — Supabase Auth not configured.");
    return;
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      supabaseUserId: true,
    },
  });

  for (const user of users) {
    if (user.supabaseUserId) {
      console.log("OK linked:", user.email);
      continue;
    }
    const password =
      user.email === DEMO_ADMIN_EMAIL ? DEMO_ADMIN_PASSWORD : defaultPassword;
    const auth = await createSupabaseAuthUser({
      email: user.email,
      password,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    if (!auth.ok) {
      console.error("FAIL", user.email, auth.error);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        supabaseUserId: auth.supabaseUserId,
        ...(user.email === DEMO_ADMIN_EMAIL
          ? {}
          : { mustChangePassword: true, passwordHash: await hashPassword(password) }),
      },
    });
    console.log(
      "Migrated:",
      user.email,
      user.email === DEMO_ADMIN_EMAIL
        ? `(password ${DEMO_ADMIN_PASSWORD})`
        : `(temp password ${defaultPassword})`
    );
  }
}

async function main() {
  const tenant = await ensureDemoTenant();
  await restoreDemoAdmin(tenant.id);
  await migrateExistingUsers();
  console.log("\nDone. Login: admin@demo.de / demo1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
