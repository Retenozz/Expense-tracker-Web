import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "expense_tracker_session";

// Inline lightweight session check — avoids importing prisma in middleware
// (middleware runs on Edge runtime which doesn't support full Node.js APIs)
function getAuthSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.LINE_CHANNEL_SECRET ||
    process.env.GEMINI_API_KEY ||
    "development-only-secret-change-me"
  );
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function hasValidSession(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;

  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return false;

  const expectedSignature = signValue(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);

  if (left.length !== right.length) return false;

  try {
    if (!timingSafeEqual(left, right)) return false;
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      userId?: string;
      exp?: number;
    };
    return !!payload.userId && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhook") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/public");

  if (isPublic) return NextResponse.next();

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!hasValidSession(sessionCookie)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next.js internals
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
