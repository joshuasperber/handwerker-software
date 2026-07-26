/**
 * CLI: create an empty tenant workspace.
 *
 * Usage:
 *   npm run tenant:create -- --name "Meier GmbH" --email admin@meier.de --password "Secret123" --first Max --last Meier [--slug meier]
 */
import "dotenv/config";
import { provisionEmptyTenant } from "../src/lib/tenants/provision";
import { prisma } from "../src/lib/prisma";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const name = arg("name");
  const email = arg("email");
  const password = arg("password");
  const firstName = arg("first") ?? "Admin";
  const lastName = arg("last") ?? "User";
  const slug = arg("slug");

  if (!name || !email || !password) {
    console.error(
      'Usage: npm run tenant:create -- --name "Firma" --email a@b.de --password "Secret123" [--first Max] [--last Meier] [--slug firma]'
    );
    process.exit(1);
  }

  const result = await provisionEmptyTenant({
    name,
    slug,
    adminEmail: email,
    adminPassword: password,
    adminFirstName: firstName,
    adminLastName: lastName,
  });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log("Tenant created:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
