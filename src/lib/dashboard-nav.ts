/**
 * Sidebar- und Tab-Aktivlogik für das Verwaltungs-Dashboard.
 *
 * Wichtig: `/dashboard` (Übersicht) gilt nur als exakter Treffer.
 * Sonst würde jeder Pfad unter `/dashboard/…` fälschlich dem Reiter „Büro“
 * zugeordnet — z. B. Inventar, Einkauf oder Finanzen.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navSectionContainsPath(
  items: { href: string }[],
  pathname: string
): boolean {
  return items.some((item) => isNavItemActive(pathname, item.href));
}
