import { prisma } from "@/lib/prisma";

export async function GET() {
  const expenses = await prisma.expense.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json(expenses);
}