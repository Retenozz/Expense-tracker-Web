import { prisma } from "@/lib/prisma";
import { setSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return Response.json(
        { error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบ" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    await setSession(user.id);

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        lineUserId: user.lineUserId,
        monthlyBudget: user.monthlyBudget,
        notificationEnabled: user.notificationEnabled,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 500 });
  }
}
