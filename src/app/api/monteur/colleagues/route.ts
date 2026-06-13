import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";

/** Kollegen aus gemeinsamen Teams und Aufträgen (read-only). */
export async function GET() {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiSuccess([]);

  const myTeamIds = await prisma.teamMember.findMany({
    where: { employeeId: employee.id },
    select: { teamId: true },
  });

  const myOrderIds = await prisma.appointment.findMany({
    where: { employeeId: employee.id, tenantId: auth.tenantId },
    select: { orderId: true },
    distinct: ["orderId"],
  });

  const colleagueIds = new Set<string>();

  if (myTeamIds.length > 0) {
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId: { in: myTeamIds.map((t) => t.teamId) },
        employeeId: { not: employee.id },
      },
      select: { employeeId: true },
    });
    for (const m of teamMembers) colleagueIds.add(m.employeeId);
  }

  if (myOrderIds.length > 0) {
    const orderColleagues = await prisma.appointment.findMany({
      where: {
        orderId: { in: myOrderIds.map((o) => o.orderId) },
        employeeId: { not: employee.id },
        tenantId: auth.tenantId,
      },
      select: { employeeId: true },
      distinct: ["employeeId"],
    });
    for (const a of orderColleagues) {
      if (a.employeeId) colleagueIds.add(a.employeeId);
    }
  }

  if (colleagueIds.size === 0) return apiSuccess([]);

  const colleagues = await prisma.employee.findMany({
    where: {
      id: { in: [...colleagueIds] },
      tenantId: auth.tenantId,
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      teamMemberships: {
        include: { team: { select: { name: true } } },
      },
    },
    orderBy: { user: { lastName: "asc" } },
  });

  return apiSuccess(
    colleagues.map((e) => ({
      id: e.id,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      email: e.user.email,
      phone: null as string | null,
      color: e.color,
      operationalStatus: e.operationalStatus,
      teams: e.teamMemberships.map((m) => m.team.name),
    }))
  );
}
