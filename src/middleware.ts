import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth-session";
import {
  hasPermission,
  getRoleHomePath,
  canAccessManagementView,
  canAccessWorkView,
  canAccessGuestPortal,
  canAccessCustomerPortal,
  type Permission,
} from "@/lib/permissions";

function getDashboardPermission(
  pathname: string
): Permission | null | "deny" {
  if (pathname === "/dashboard" || pathname === "/dashboard/profil") return null;
  if (pathname === "/dashboard/auftraege/neu") return "orders.write";
  if (pathname === "/dashboard/kunden/neu") return "customers.write";
  if (pathname.startsWith("/dashboard/auftraege")) return "orders.read";
  if (pathname.startsWith("/dashboard/projekte")) return "orders.read";
  if (pathname.startsWith("/dashboard/termine")) return "appointments.read";
  if (pathname.startsWith("/dashboard/inventar")) return "inventory.read";
  if (pathname.startsWith("/dashboard/einkauf")) return "inventory.read";
  if (pathname.startsWith("/dashboard/disposition")) return "appointments.read";
  if (pathname.startsWith("/dashboard/leitstand")) return "appointments.read";
  if (pathname.startsWith("/dashboard/eingang")) return "work_requests.manage";
  if (pathname.startsWith("/dashboard/rollen")) return "roles.manage";
  if (pathname.startsWith("/dashboard/kalkulation/einstellungen")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/kalkulation/zonen")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/kalkulation")) return "calculations.read";
  if (pathname.startsWith("/dashboard/rechnungen")) return "invoices.read";
  if (pathname.startsWith("/dashboard/umsatz")) return "invoices.read";
  if (pathname.startsWith("/dashboard/finanzuebersicht")) return "invoices.read";
  if (pathname.startsWith("/dashboard/ausgaben")) return "invoices.read";
  if (pathname.startsWith("/dashboard/kunden")) return "customers.read";
  if (pathname.startsWith("/dashboard/mitarbeiter")) return "employees.read";
  if (pathname.startsWith("/dashboard/leistungen")) return "services.read";
  if (pathname.startsWith("/dashboard/maschinen")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/einstellungen/betrieb")) return "tenant.manage";
  if (pathname.startsWith("/dashboard/einstellungen/rechnung")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/einstellungen/benachrichtigungen")) return "notifications.manage";
  if (pathname.startsWith("/dashboard/einstellungen/sicherheit")) return "tenant.manage";
  if (pathname.startsWith("/dashboard/einstellungen/system")) return "notifications.manage";
  if (pathname.startsWith("/dashboard/einstellungen")) return "tenant.manage";
  if (pathname.startsWith("/dashboard/nachrichten")) return "messages.read";
  if (pathname.startsWith("/dashboard/ki-assistent")) return "ai.chat";
  if (pathname.startsWith("/dashboard/stundenzettel")) return "monteur.own";
  if (pathname.startsWith("/dashboard/stunden")) return "time_entries.read";
  return "deny";
}

/** Map /work/* → /monteur/* (freundliche Alias-URLs). */
function rewriteWorkAlias(pathname: string): string | null {
  if (!pathname.startsWith("/work")) return null;
  const map: Record<string, string> = {
    "/work": "/monteur/heute",
    "/work/today": "/monteur/heute",
    "/work/heute": "/monteur/heute",
    "/work/orders": "/monteur/auftraege",
    "/work/auftraege": "/monteur/auftraege",
    "/work/times": "/monteur/zeiten",
    "/work/zeiten": "/monteur/zeiten",
    "/work/assistant": "/monteur/assistent",
    "/work/assistent": "/monteur/assistent",
    "/work/more": "/monteur/mehr",
    "/work/mehr": "/monteur/mehr",
    "/work/profile": "/monteur/profil",
    "/work/profil": "/monteur/profil",
    "/work/calendar": "/monteur/kalender",
    "/work/kalender": "/monteur/kalender",
  };
  if (map[pathname]) return map[pathname];
  if (pathname.startsWith("/work/orders/")) {
    return `/monteur/auftrag/${pathname.slice("/work/orders/".length)}`;
  }
  if (pathname.startsWith("/work/auftraege/")) {
    return `/monteur/auftrag/${pathname.slice("/work/auftraege/".length)}`;
  }
  return `/monteur${pathname.slice("/work".length)}` || "/monteur/heute";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token =
    request.cookies.get("jomaster-session")?.value ??
    request.cookies.get("handwerker-session")?.value;
  let session = null;
  if (token) {
    try {
      session = await verifySession(token);
    } catch (error) {
      console.error("[middleware] session verify failed:", error);
    }
  }

  // Alias /work → /monteur (sichtbare URL umschreiben, gleiche App)
  const workTarget = rewriteWorkAlias(pathname);
  if (workTarget) {
    const url = request.nextUrl.clone();
    url.pathname = workTarget;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/dashboard")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (session.role === "GAST") return NextResponse.redirect(new URL("/portal", request.url));
    if (session.role === "KUNDE") return NextResponse.redirect(new URL("/kunde", request.url));

    // Feldrollen: gar keine Verwaltungsansicht — auch kein Profil unter /dashboard.
    if (!canAccessManagementView(session.role)) {
      if (pathname.startsWith("/dashboard/profil")) {
        const qs = request.nextUrl.search;
        return NextResponse.redirect(new URL(`/monteur/profil${qs}`, request.url));
      }
      return NextResponse.redirect(new URL("/monteur/heute", request.url));
    }

    // Office: Reiter bleiben in der Verwaltung — kein heimlicher Wechsel zur Arbeit.
    const perm = getDashboardPermission(pathname);
    if (perm === "deny") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (
      perm !== null &&
      !hasPermission(session.role, perm, { canManageRoles: session.canManageRoles })
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/monteur")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (!canAccessWorkView(session.role)) {
      return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
    }
  }

  if (pathname.startsWith("/portal")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (!canAccessGuestPortal(session.role)) {
      return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
    }
  }

  if (pathname.startsWith("/kunde")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (!canAccessCustomerPortal(session.role)) {
      return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/monteur/:path*",
    "/work",
    "/work/:path*",
    "/portal/:path*",
    "/kunde/:path*",
  ],
};
