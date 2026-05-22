import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });
    const compactExpenses = expenses.map((e) => ({
  amount: e.amount,
  merchant: e.merchant,
  category: e.category,
}));

    let text =
      "Your spending looks stable this week.";

    if (expenses.length > 0) {
      try {
        const model =
          genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
          });

        const result =
          await model.generateContent(`
You are a premium finance AI.

Analyze this expense data:

${JSON.stringify(compactExpenses)}

Write:
- short insight
- premium tone
- max 2 sentences
`);

        text = result.response.text();
      } catch (e) {
        console.error(e);
      }
    }

    return Response.json({
      text,
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        text: "Unable to generate insight.",
      },
      {
        status: 500,
      }
    );
  }
}