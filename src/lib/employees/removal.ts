const DISPOSABLE_EMPLOYEE_RELATIONS = new Set([
  "qualifications",
  "workingHours",
  "teamMemberships",
  "assignedVehicles",
]);

/**
 * Mitarbeiter mit fachlicher Historie werden deaktiviert statt gelöscht.
 * Reine Stammdaten-Zuordnungen dürfen zusammen mit einem unbenutzten Konto entfallen.
 */
export function mustArchiveEmployee(
  employeeRelations: Record<string, number>,
  userRelations: Record<string, number>
): boolean {
  const hasEmployeeHistory = Object.entries(employeeRelations).some(
    ([relation, count]) =>
      !DISPOSABLE_EMPLOYEE_RELATIONS.has(relation) && count > 0
  );
  const hasUserHistory = Object.values(userRelations).some((count) => count > 0);
  return hasEmployeeHistory || hasUserHistory;
}
