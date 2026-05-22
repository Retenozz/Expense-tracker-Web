import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function getFallbackInsight(total: number, topCategory?: [string, number]) {
  if (!topCategory) {
    return `เดือนนี้มีรายจ่ายรวม ${total.toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    })} ภาพรวมยังนิ่งอยู่ ลองเพิ่มข้อมูลอีกนิดเพื่อให้ insight แม่นขึ้น`;
  }

  return `เดือนนี้ใช้ไป ${total.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  })} และหมวด ${topCategory[0]} สูงสุด ถ้าจะคุมงบเร็วที่สุดให้เริ่มเช็กหมวดนี้ก่อน`;
}

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json(
        {
          text: "กำลังเตรียม insight ส่วนตัวให้คุณ ลองรีเฟรชอีกครั้งครับ",
        },
        { status: 401 }
      );
    }

    const expenses = await prisma.expense.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    });

    const compactExpenses = expenses.map((expense) => ({
      amount: expense.amount ?? 0,
      merchant: expense.merchant ?? "Unknown",
      category: expense.category ?? "Other",
    }));

    const grouped = compactExpenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});

    const total = compactExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const topCategory = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0];

    let text = getFallbackInsight(total, topCategory);

    if (genAI && compactExpenses.length > 0) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
        });

        const result = await model.generateContent(`
คุณคือผู้ช่วยการเงินที่พูดภาษาไทยแบบกระชับ ดูแพง และเข้าใจง่าย
วิเคราะห์ข้อมูลรายจ่ายต่อไปนี้ของผู้ใช้:
${JSON.stringify(compactExpenses)}

กติกา:
- ตอบไม่เกิน 2 ประโยค
- ชี้หมวดหรือพฤติกรรมที่ควรระวังถ้ามี
- ถ้าข้อมูลยังน้อย ให้บอกแบบให้กำลังใจ
`);

        text = result.response.text().trim() || text;
      } catch (error) {
        console.error(error);
      }
    }

    return Response.json({ text });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        text: "ยังสร้าง insight ไม่สำเร็จในตอนนี้",
      },
      { status: 500 }
    );
  }
}
