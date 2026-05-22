import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      monthlyBudget?: number;
      notificationEnabled?: boolean;
    };

    const data: {
      name?: string;
      monthlyBudget?: number;
      notificationEnabled?: boolean;
    } = {};

    if (typeof body.name === "string" && body.name.trim().length >= 2) {
      data.name = body.name.trim();
    }

    if (typeof body.monthlyBudget === "number" && body.monthlyBudget >= 0) {
      data.monthlyBudget = body.monthlyBudget;
    }

    if (typeof body.notificationEnabled === "boolean") {
      data.notificationEnabled = body.notificationEnabled;
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data,
    });

    return Response.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        lineUserId: updatedUser.lineUserId,
        monthlyBudget: updatedUser.monthlyBudget,
        notificationEnabled: updatedUser.notificationEnabled,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "อัปเดตบัญชีไม่สำเร็จ" }, { status: 500 });
  }
}
