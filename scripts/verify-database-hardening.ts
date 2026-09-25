import "dotenv/config";
import { Client } from "pg";

const protectedTables = [
  "AiChatMessage",
  "AiChatSession",
  "OrderAssignee",
  "OrderTypeDefinition",
  "Project",
  "ProjectCost",
  "ProjectFile",
  "ProjectMember",
  "ProjectNote",
  "WorkRequest",
];

function assertZero(label: string, value: number) {
  if (value !== 0) throw new Error(`${label}: erwartet 0, gefunden ${value}`);
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL oder DATABASE_URL fehlt");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const rls = await client.query<{ table_name: string; policy_count: number }>(
      `select c.relname as table_name,
              count(p.policyname)::int as policy_count
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       left join pg_policies p
         on p.schemaname = n.nspname and p.tablename = c.relname
       where n.nspname = $1
         and c.relname = any($2::text[])
         and c.relrowsecurity
       group by c.relname
       order by c.relname`,
      ["public", protectedTables]
    );
    if (rls.rows.length !== protectedTables.length) {
      const found = new Set(rls.rows.map((row) => row.table_name));
      throw new Error(
        `RLS fehlt für: ${protectedTables.filter((table) => !found.has(table)).join(", ")}`
      );
    }
    const incomplete = rls.rows.filter((row) => row.policy_count < 4);
    if (incomplete.length) {
      throw new Error(
        `CRUD-Policies unvollständig: ${incomplete.map((row) => `${row.table_name} (${row.policy_count})`).join(", ")}`
      );
    }

    const grants = await client.query<{ count: number }>(
      `select count(*)::int as count
       from information_schema.role_table_grants
       where table_schema = $1
         and table_name = any($2::text[])
         and grantee = any($3::text[])`,
      ["public", protectedTables, ["anon", "authenticated"]]
    );
    assertZero("Data-API-Grants für anon/authenticated", grants.rows[0]?.count ?? -1);

    const terminalAppointments = await client.query<{ count: number }>(
      `select count(*)::int as count
       from public."Appointment" a
       join public."Order" o on o.id = a."orderId"
       where o.status::text = any($1::text[])
         and a.status::text = any($2::text[])`,
      [
        ["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"],
        ["GEPLANT", "UNTERWEGS", "ANGEKOMMEN", "IN_ARBEIT"],
      ]
    );
    assertZero(
      "Aktive Termine an terminalen Aufträgen",
      terminalAppointments.rows[0]?.count ?? -1
    );

    const negativeOrdered = await client.query<{ count: number }>(
      `select count(*)::int as count
       from public."StockBalance"
       where "orderedQuantity" < 0`
    );
    assertZero("Negative offene Bestellmengen", negativeOrdered.rows[0]?.count ?? -1);

    const constraint = await client.query<{ valid: boolean }>(
      `select convalidated as valid
       from pg_constraint
       where conname = $1`,
      ["StockBalance_orderedQuantity_nonnegative"]
    );
    if (constraint.rows[0]?.valid !== true) {
      throw new Error("CHECK-Constraint für orderedQuantity fehlt oder ist nicht validiert");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          rlsTables: rls.rows.length,
          policies: rls.rows.reduce((sum, row) => sum + row.policy_count, 0),
          exposedGrants: grants.rows[0]?.count ?? 0,
          activeTerminalAppointments: terminalAppointments.rows[0]?.count ?? 0,
          negativeOrderedBalances: negativeOrdered.rows[0]?.count ?? 0,
          orderedQuantityConstraint: "valid",
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
