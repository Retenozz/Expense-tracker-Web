import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

function escapeCsv(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
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

  const header = ["Date", "Merchant", "Category", "Amount", "Raw Text"];
  const rows = expenses.map((expense) => [
    expense.createdAt.toISOString(),
    expense.merchant ?? "",
    expense.category ?? "Other",
    expense.amount ?? 0,
    expense.rawText ?? "",
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="expenses.csv"',
    },
  });
}
