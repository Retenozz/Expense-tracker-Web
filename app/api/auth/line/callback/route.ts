import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/auth/line/callback`,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      console.error("LINE token exchange failed", await tokenRes.text());
      return NextResponse.redirect(`${origin}/login?error=token_failed`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    // Get LINE profile
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=profile_failed`);
    }

    const profile = (await profileRes.json()) as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
    };

    // Upsert user by lineUserId
    let user = await prisma.user.findUnique({
      where: { lineUserId: profile.userId },
    });

    if (!user) {
      // Check if there's a personal/default user to claim
      const personalUser = await prisma.user.findFirst({
        where: { lineUserId: null },
        orderBy: { createdAt: "asc" },
      });

      if (personalUser) {
        user = await prisma.user.update({
          where: { id: personalUser.id },
          data: { lineUserId: profile.userId, name: profile.displayName },
        });
      } else {
        user = await prisma.user.create({
          data: {
            name: profile.displayName,
            lineUserId: profile.userId,
          },
        });
      }
    }

    await setSession(user.id);

    return NextResponse.redirect(`${origin}/`);
  } catch (error) {
    console.error("LINE OAuth callback error", error);
    return NextResponse.redirect(`${origin}/login?error=server_error`);
  }
}
