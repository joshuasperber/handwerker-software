import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth-session";
import {
  hasPermission,
  getRoleHomePath,
  canAccessDashboard,
  canAccessMonteurApp,
  canAccessGuestPortal,
  canAccessCustomerPortal,
  type Permission,
} from "@/lib/permissions";

function getDashboardPermission(pathname: string): Permission | null | undefined {
  if (pathname === "/dashboard" || pathname === "/dashboard/profil") return null;
  if (pathname === "/dashboard/auftraege/neu") return "orders.write";
  if (pathname === "/dashboard/kunden/neu") return "customers.write";
  if (pathname.startsWith("/dashboard/auftraege")) return "orders.read";
  if (pathname.startsWith("/dashboard/termine")) return "appointments.read";
  if (pathname.startsWith("/dashboard/inventar")) return "inventory.read";
  if (pathname.startsWith("/dashboard/einkauf")) return "inventory.read";
  if (pathname.startsWith("/dashboard/disposition")) return "appointments.read";
  if (pathname.startsWith("/dashboard/leitstand")) return "appointments.read";
  if (pathname.startsWith("/dashboard/kalkulation/einstellungen")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/kalkulation/zonen")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/kalkulation")) return "calculations.read";
  if (pathname.startsWith("/dashboard/rechnungen")) return "invoices.read";
  if (pathname.startsWith("/dashboard/kunden")) return "customers.read";
  if (pathname.startsWith("/dashboard/mitarbeiter")) return "employees.read";
  if (pathname.startsWith("/dashboard/leistungen")) return "services.read";
  if (pathname.startsWith("/dashboard/maschinen")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/einstellungen/rechnung")) return "calculations.settings";
  if (pathname.startsWith("/dashboard/einstellungen/benachrichtigungen")) return "notifications.manage";
  if (pathname.startsWith("/dashboard/nachrichten")) return "messages.read";
  if (pathname.startsWith("/dashboard/stundenzettel")) return "monteur.own";
  return undefined;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("handwerker-session")?.value;
  const session = token ? await verifySession(token) : null;

  if (pathname.startsWith("/dashboard")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (session.role === "GAST") return NextResponse.redirect(new URL("/portal", request.url));
    if (session.role === "KUNDE") return NextResponse.redirect(new URL("/kunde", request.url));
    if (!canAccessDashboard(session.role)) {
      return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
    }
    const perm = getDashboardPermission(pathname);
    if (perm !== undefined && perm !== null && !hasPermission(session.role, perm)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/monteur")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (!canAccessMonteurApp(session.role)) {
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
  matcher: ["/dashboard/:path*", "/monteur/:path*", "/portal/:path*", "/kunde/:path*"],
};
