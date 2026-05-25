import { cookies } from "next/headers";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "expense_tracker_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: string;
  exp: number;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  lineUserId: string | null;
  monthlyBudget: number;
  notificationEnabled: boolean;
};

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

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(derived, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function serializeSession(payload: SessionPayload) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${signValue(value)}`;
}

function parseSession(token: string | undefined) {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = signValue(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);

  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload.userId || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string | null;
  lineUserId: string | null;
  monthlyBudget: number;
  notificationEnabled: boolean;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    lineUserId: user.lineUserId,
    monthlyBudget: user.monthlyBudget,
    notificationEnabled: user.notificationEnabled,
  };
}

// Only used by LINE webhook — finds or creates a user for incoming LINE messages
export async function getOrCreatePersonalUser(lineUserId?: string) {
  if (lineUserId) {
    // Fast path: user already linked to this LINE ID
    const existing = await prisma.user.findUnique({ where: { lineUserId } });
    if (existing) return existing;
  }

  // Find the earliest user (personal/default account)
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (firstUser) {
    if (lineUserId && !firstUser.lineUserId) {
      // Link LINE ID to existing default user
      try {
        return await prisma.user.update({
          where: { id: firstUser.id },
          data: { lineUserId },
        });
      } catch {
        return firstUser;
      }
    }
    return firstUser;
  }

  // No users at all — create one
  return prisma.user.create({
    data: {
      name: process.env.DEFAULT_USER_NAME || "Orion",
      email: "personal@ai-expense-tracker.local",
      lineUserId,
    },
  });
}

export function hashPassword(password: string) {
  return createPasswordHash(password);
}

export function verifyPassword(password: string, storedHash: string) {
  return verifyPasswordHash(password, storedHash);
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  const payload = serializeSession({
    userId,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  cookieStore.set(SESSION_COOKIE_NAME, payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Returns the logged-in user from session cookie.
 * Returns null if no valid session — middleware handles the redirect.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = parseSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!session) return null;

  // Single DB query — just fetch the user by ID from session
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      lineUserId: true,
      monthlyBudget: true,
      notificationEnabled: true,
    },
  });

  if (!user) return null;

  return serializeUser(user);
}

export async function requireSessionUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function claimOrphanedExpenses(userId: string) {
  const users = await prisma.user.count();
  if (users === 1) {
    await prisma.expense.updateMany({
      where: { userId: null },
      data: { userId },
    });
  }
}
