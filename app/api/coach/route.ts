import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getCoachResponse } from "@/lib/finance-coach";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      question?: string;
    };

    const [expenses, subscriptions] = await Promise.all([
      prisma.expense.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 40,
      }),
      prisma.recurringSubscription.findMany({
        where: {
          userId: user.id,
          isActive: true,
        },
        orderBy: {
          nextBillingDate: "asc",
        },
        take: 20,
      }),
    ]);

    const text = await getCoachResponse(
      expenses.map((expense) => ({
        amount: expense.amount ?? 0,
        merchant: expense.merchant ?? "Unknown",
        category: expense.category ?? "Other",
        createdAt: expense.createdAt.toISOString(),
      })),
      subscriptions.map((subscription) => ({
        name: subscription.name,
        amount: subscription.amount,
        category: subscription.category,
        frequency: subscription.frequency,
        nextBillingDate: subscription.nextBillingDate.toISOString(),
      })),
      body.question?.trim()
    );

    return Response.json({ text });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "โค้ชการเงินยังตอบไม่ได้ตอนนี้" }, { status: 500 });
  }
}
