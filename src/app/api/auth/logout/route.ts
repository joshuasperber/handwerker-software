import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  clearSessionCookiesOnResponse,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth-session";

function loginRedirectUrl(request: NextRequest): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  // Immer denselben Host wie die aktuelle Anfrage nutzen,
  // sonst landet man auf einer anderen Domain ohne gelöschtes Cookie.
  if (forwardedHost) {
    return new URL("/login", `${forwardedProto}://${forwardedHost}`);
  }

  return new URL("/login", request.url);
}

async function handleLogout(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");

  if (wantsJson) {
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    clearSessionCookiesOnResponse(response);
    return response;
  }

  // 303: Nach Form-POST folgt Browser mit GET /login
  const response = NextResponse.redirect(loginRedirectUrl(request), 303);
  clearSessionCookiesOnResponse(response);
  // Explizit nochmals setzen (manche Browser brauchen maxAge=0 + Expires)
  response.cookies.set(COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}
