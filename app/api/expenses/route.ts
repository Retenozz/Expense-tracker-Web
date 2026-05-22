import { prisma } from "@/lib/prisma";
import { parseExpenseFromText } from "@/lib/expense-ai";
import { getSessionUser } from "@/lib/auth";

function serializeExpense(expense: {
  id: string;
  amount: number | null;
  merchant: string | null;
  category: string | null;
  rawText: string | null;
  createdAt: Date;
}) {
  return {
    id: expense.id,
    amount: expense.amount ?? 0,
    merchant: expense.merchant ?? "รายการไม่ระบุ",
    category: expense.category ?? "Other",
    rawText: expense.rawText ?? "",
    createdAt: expense.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expenses = await prisma.expense.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json(expenses.map(serializeExpense));
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      input?: string;
      amount?: number;
      merchant?: string;
      category?: string;
    };

    const parsed = body.input?.trim()
      ? await parseExpenseFromText(body.input)
      : {
          amount: body.amount,
          merchant: body.merchant?.trim() || "รายการไม่ระบุ",
          category: body.category?.trim() || "Other",
          sourceText: "",
        };

    if (!parsed.amount || parsed.amount <= 0) {
      return Response.json(
        {
          error: "กรุณาระบุจำนวนเงินให้ถูกต้อง",
        },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.create({
      data: {
        userId: user.id,
        amount: parsed.amount,
        merchant: parsed.merchant,
        category: parsed.category,
        rawText: parsed.sourceText || body.input || "",
      },
    });

    return Response.json({
      expense: serializeExpense(expense),
      message: `เพิ่มรายการ ${parsed.merchant} ฿${parsed.amount.toLocaleString(
        "th-TH"
      )} เรียบร้อยแล้ว`,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "ยังอ่านรายการนี้ไม่ออก ลองพิมพ์แบบ 'ค่าน้ำ 35' หรือ 'กาแฟ Amazon 65'",
      },
      { status: 400 }
    );
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
    return Response.json({ error: "Missing expense id." }, { status: 400 });
  }

  await prisma.expense.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  return Response.json({ ok: true });
}
