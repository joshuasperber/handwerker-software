/**
 * Reset known demo/admin passwords and ensure ADMIN has an Employee profile.
 * Run: npx tsx scripts/fix-login-access.ts
 */
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { updateSupabaseAuthPassword } from "../src/lib/supabase/auth-users";
import { pickDistinctEmployeeColor } from "../src/lib/employee-colors";

const RESET_PASSWORD = "admin1234";
const EMAILS = [
  "steerausberlin@gmail.com",
  "steerausberlin@gmail.de",
  "joshua.sperber@web.de",
];

async function main() {
  const passwordHash = await hashPassword(RESET_PASSWORD);

  for (const email of EMAILS) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      include: { employee: true },
    });
    if (!user) {
      console.log("skip missing", email);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      },
    });

    if (user.supabaseUserId) {
      const updated = await updateSupabaseAuthPassword(
        user.supabaseUserId,
        RESET_PASSWORD
      );
      console.log("supabase password", email, updated);
    } else {
      console.log("no supabase id", email);
    }

    if (!user.employee) {
      const color = await pickDistinctEmployeeColor(user.tenantId);
      await prisma.employee.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          color,
        },
      });
      console.log("created employee profile", email);
    } else {
      console.log("employee exists", email);
    }

    await prisma.loginAttempt.deleteMany({
      where: { email: email.toLowerCase() },
    });
    console.log("cleared login attempts", email);
  }

  console.log("\nDone. Login with password:", RESET_PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
