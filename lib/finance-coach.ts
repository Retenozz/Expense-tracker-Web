import { GoogleGenerativeAI } from "@google/generative-ai";

type CoachExpense = {
  amount: number;
  merchant: string;
  category: string;
  createdAt: string;
};

type CoachSubscription = {
  name: string;
  amount: number;
  category: string;
  frequency: string;
  nextBillingDate: string;
};

function getMonthWindow(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function getTopCategory(expenses: CoachExpense[]) {
  const grouped = expenses.reduce<Record<string, number>>((acc, expense) => {
    acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
    return acc;
  }, {});

  return Object.entries(grouped).sort((a, b) => b[1] - a[1])[0];
}

function buildHeuristicCoachMessage(
  expenses: CoachExpense[],
  subscriptions: CoachSubscription[],
  question?: string
) {
  if (expenses.length === 0 && subscriptions.length === 0) {
    return "เริ่มเพิ่มรายจ่ายหรือค่าสมาชิกรายเดือนอีกนิด แล้วโค้ชการเงินจะช่วยวิเคราะห์ได้แม่นขึ้นครับ";
  }

  const { start, end } = getMonthWindow();
  const monthlyExpenses = expenses.filter((expense) => {
    const createdAt = new Date(expense.createdAt);
    return createdAt >= start && createdAt < end;
  });

  const total = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const topCategory = getTopCategory(monthlyExpenses);
  const monthlySubscriptionLoad = subscriptions.reduce((sum, subscription) => {
    if (subscription.frequency === "YEARLY") {
      return sum + subscription.amount / 12;
    }

    if (subscription.frequency === "WEEKLY") {
      return sum + subscription.amount * 4;
    }

    return sum + subscription.amount;
  }, 0);

  if (question?.toLowerCase().includes("subscription")) {
    return subscriptions.length === 0
      ? "ตอนนี้ยังไม่มี recurring subscriptions ถ้าคุณใส่ค่าใช้จ่ายประจำเข้ามา โค้ชจะช่วยคุม fixed cost ได้ดีขึ้น"
      : `คุณมี fixed cost ประมาณ ${monthlySubscriptionLoad.toLocaleString("th-TH", {
          style: "currency",
          currency: "THB",
          maximumFractionDigits: 0,
        })} ต่อเดือน ลองทบทวนตัวที่ใช้น้อยแต่จ่ายประจำก่อนเป็นอันดับแรก`;
  }

  if (!topCategory) {
    return `เดือนนี้ใช้ไป ${total.toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    })} และมี fixed cost ราว ${monthlySubscriptionLoad.toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    })} ลองรักษาจังหวะการใช้เงินแบบนี้ต่อได้เลย`;
  }

  return `เดือนนี้คุณใช้ไป ${total.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  })} โดยหมวด ${topCategory[0]} กินสัดส่วนสูงสุด และมี fixed cost อีกประมาณ ${monthlySubscriptionLoad.toLocaleString(
    "th-TH",
    {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }
  )} ต่อเดือน ถ้าอยากลดเงินไหลออกเร็วที่สุดให้เริ่มจากสองก้อนนี้ก่อนครับ`;
}

export async function getCoachResponse(
  expenses: CoachExpense[],
  subscriptions: CoachSubscription[],
  question?: string
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return buildHeuristicCoachMessage(expenses, subscriptions, question);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(`
คุณคือ AI financial coach ส่วนตัวของผู้ใช้แอปติดตามรายจ่าย
ให้คำแนะนำเป็นภาษาไทย แบบกระชับ ชัด และลงมือทำได้จริง

คำถามจากผู้ใช้:
${question || "ช่วยสรุปภาพรวมการเงินและข้อควรปรับ"}

รายจ่ายล่าสุด:
${JSON.stringify(expenses)}

Recurring subscriptions:
${JSON.stringify(subscriptions)}

กติกา:
- ตอบไม่เกิน 3 ประโยค
- ถ้ามีจุดเสี่ยง ให้ระบุให้ชัด
- ถ้าไม่มีข้อมูลพอ ให้แนะนำสิ่งที่ควรเก็บเพิ่ม
`);

    return result.response.text().trim();
  } catch (error) {
    console.error(error);
    return buildHeuristicCoachMessage(expenses, subscriptions, question);
  }
}
