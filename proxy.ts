import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "expense_tracker_session";

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.LINE_CHANNEL_SECRET ||
    process.env.GEMINI_API_KEY ||
    "development-only-secret-change-me"
  );
}

// Web Crypto HMAC-SHA256 — works in Edge Runtime (no node:crypto)
async function signValue(value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  // base64url encode
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hasValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;

  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const encoded = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);
  if (!encoded || !signature) return false;

  const expectedSignature = await signValue(encoded);

  // Constant-time comparison via Web Crypto
  if (signature.length !== expectedSignature.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  if (diff !== 0) return false;

  try {
    const json = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { userId?: string; exp?: number };
    return !!payload.userId && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhook") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/pwa-icons");

  if (isPublic) return NextResponse.next();

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!(await hasValidSession(sessionCookie))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
