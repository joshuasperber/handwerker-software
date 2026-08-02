import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  canAccessManagementView,
  canAccessWorkView,
  canSwitchAppViews,
} from "@/lib/permissions";
import { parseAppViewMode, WORK_VIEW_COOKIE, type AppViewMode } from "@/lib/work-view";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const view = parseAppViewMode(body.view);
  if (!view) return apiError("Ungültige Ansicht", 400);

  if (view === "arbeit" && !canAccessWorkView(auth.role)) {
    return apiError("Keine Berechtigung für die Arbeitsansicht", 403);
  }
  if (view === "verwaltung" && !canAccessManagementView(auth.role)) {
    return apiError("Keine Berechtigung für die Verwaltungsansicht", 403);
  }
  // Bewusster Wechsel nur, wenn beide Ansichten erlaubt sind
  if (!canSwitchAppViews(auth.role)) {
    return apiError("Kein Wechsel zwischen Ansichten für diese Rolle", 403);
  }

  const res = NextResponse.json({ success: true, data: { view } });
  res.cookies.set(WORK_VIEW_COOKIE, view as AppViewMode, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  return apiSuccess({
    canSwitch: canSwitchAppViews(auth.role),
    canAccessArbeit: canAccessWorkView(auth.role),
    canAccessVerwaltung: canAccessManagementView(auth.role),
  });
}
