import { SubscriptionFrequency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

function serializeSubscription(subscription: {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: SubscriptionFrequency;
  nextBillingDate: Date;
  note: string | null;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: subscription.id,
    name: subscription.name,
    amount: subscription.amount,
    category: subscription.category,
    frequency: subscription.frequency,
    nextBillingDate: subscription.nextBillingDate.toISOString(),
    note: subscription.note ?? "",
    isActive: subscription.isActive,
    createdAt: subscription.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await prisma.recurringSubscription.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      nextBillingDate: "asc",
    },
  });

  return Response.json(subscriptions.map(serializeSubscription));
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      amount?: number;
      category?: string;
      frequency?: SubscriptionFrequency;
      nextBillingDate?: string;
      note?: string;
    };

    const name = body.name?.trim();
    const amount = Number(body.amount);
    const category = body.category?.trim() || "Other";
    const frequency = body.frequency || SubscriptionFrequency.MONTHLY;
    const nextBillingDate = body.nextBillingDate
      ? new Date(body.nextBillingDate)
      : new Date();

    if (!name) {
      return Response.json({ error: "กรุณาใส่ชื่อรายการ" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "จำนวนเงินไม่ถูกต้อง" }, { status: 400 });
    }

    if (Number.isNaN(nextBillingDate.getTime())) {
      return Response.json({ error: "วันที่ตัดรอบไม่ถูกต้อง" }, { status: 400 });
    }

    const subscription = await prisma.recurringSubscription.create({
      data: {
        userId: user.id,
        name,
        amount,
        category,
        frequency,
        nextBillingDate,
        note: body.note?.trim() || null,
      },
    });

    return Response.json({
      subscription: serializeSubscription(subscription),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "เพิ่ม recurring subscription ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing subscription id" }, { status: 400 });
  }

  await prisma.recurringSubscription.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  return Response.json({ ok: true });
}
