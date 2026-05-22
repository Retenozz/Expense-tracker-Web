import { prisma } from "@/lib/prisma";
import { claimOrphanedExpenses, hashPassword, setSession } from "@/lib/auth";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!name || name.length < 2) {
      return Response.json({ error: "กรุณาใส่ชื่ออย่างน้อย 2 ตัวอักษร" }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return Response.json({ error: "อีเมลยังไม่ถูกต้อง" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return Response.json(
        { error: "รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return Response.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
      },
    });

    await claimOrphanedExpenses(user.id);
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
    return Response.json({ error: "สมัครสมาชิกไม่สำเร็จ" }, { status: 500 });
  }
}
