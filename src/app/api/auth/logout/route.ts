import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

function loginRedirectUrl(request: NextRequest): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return new URL("/login", `${forwardedProto}://${forwardedHost}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return new URL("/login", appUrl);
  }

  return new URL("/login", request.url);
}

async function handleLogout(request: NextRequest) {
  // 303 statt 307: Nach Form-POST darf der Browser /login per GET laden.
  // Bei 307 bleibt die Methode POST → /login antwortet mit 405 und leerer Seite.
  const response = NextResponse.redirect(loginRedirectUrl(request), 303);
  response.cookies.set(COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}
