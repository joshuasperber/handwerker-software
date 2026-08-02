import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";

export type ColleagueKind = "mitarbeiter" | "partner";

/**
 * Team in der Arbeitsansicht:
 * - Alle aktiven Unternehmens-Mitarbeiter (nicht nur gemeinsames Team)
 * - Unternehmenspartner (GAST)
 */
export async function GET() {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const me = await getEmployeeForUser(auth);

  const myTeamIds = me
    ? (
        await prisma.teamMember.findMany({
          where: { employeeId: me.id },
          select: { teamId: true },
        })
      ).map((t) => t.teamId)
    : [];

  const staff = await prisma.employee.findMany({
    where: {
      tenantId: auth.tenantId,
      user: { isActive: true, role: { notIn: ["KUNDE", "GAST"] } },
      ...(me ? { id: { not: me.id } } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      teamMemberships: {
        include: { team: { select: { id: true, name: true } } },
      },
    },
    orderBy: { user: { lastName: "asc" } },
  });

  const teamColleagueIds = new Set<string>();
  if (myTeamIds.length) {
    for (const e of staff) {
      if (e.teamMemberships.some((m) => myTeamIds.includes(m.team.id))) {
        teamColleagueIds.add(e.id);
      }
    }
  }

  const partners = await prisma.user.findMany({
    where: {
      tenantId: auth.tenantId,
      isActive: true,
      role: "GAST",
      id: { not: auth.id },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const staffRows = staff.map((e) => {
    const isTeamColleague = teamColleagueIds.has(e.id);
    return {
      id: e.id,
      userId: e.user.id,
      kind: "mitarbeiter" as ColleagueKind,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      email: e.user.email,
      phone: e.user.phone,
      role: e.user.role,
      color: e.color,
      operationalStatus: e.operationalStatus,
      teams: e.teamMemberships.map((m) => m.team.name),
      isTeamColleague,
      group: isTeamColleague ? ("team" as const) : ("company" as const),
    };
  });

  // Teamkollegen zuerst, dann restliche Unternehmenskollegen
  staffRows.sort((a, b) => {
    if (a.isTeamColleague !== b.isTeamColleague) return a.isTeamColleague ? -1 : 1;
    return a.lastName.localeCompare(b.lastName, "de");
  });

  const partnerRows = partners.map((u) => ({
    id: `partner-${u.id}`,
    userId: u.id,
    kind: "partner" as ColleagueKind,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    color: "#64748b",
    operationalStatus: "PARTNER",
    teams: ["Unternehmenspartner"],
    isTeamColleague: false,
    group: "partner" as const,
  }));

  return apiSuccess({
    meEmployeeId: me?.id ?? null,
    hasTeamColleagues: teamColleagueIds.size > 0,
    colleagues: [...staffRows, ...partnerRows],
  });
}
