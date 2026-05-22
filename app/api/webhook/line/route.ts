import { prisma } from "@/lib/prisma";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const event = body.events?.[0];

    if (!event) {
      return Response.json({ ok: true });
    }

    // TEXT MESSAGE
   // TEXT MESSAGE
if (event.message?.type === "text") {
  const text = event.message.text;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const result = await model.generateContent(`
Extract expense info from this message.

Message:
"${text}"

Return JSON only:

{
  "amount": number,
  "merchant": string,
  "category": string
}

Rules:
- category must be:
Food
Coffee
Transport
Shopping
Bills
Travel
Health
Other

- If unclear, use Other.
`);

  const raw = result.response.text();

  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error(cleaned);

    return Response.json({
      error: "AI parse failed",
    });
  }

  await prisma.expense.create({
    data: {
      amount: parsed.amount,
      merchant: parsed.merchant,
      category: parsed.category,
      rawText: text,
    },
  });

  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text:
            `✦ Expense Saved\n\n` +
            `${parsed.merchant}\n` +
            `฿${parsed.amount}\n` +
            `${parsed.category}`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  return Response.json({ ok: true });
}

    // IMAGE MESSAGE
    if (event.message?.type === "image") {
      const messageId = event.message.id;

      // download image from line
      const imageRes = await axios.get(
        `https://api-data.line.me/v2/bot/message/${messageId}/content`,
        {
          responseType: "arraybuffer",
          headers: {
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          },
        }
      );

      const base64Image = Buffer.from(
        imageRes.data
      ).toString("base64");

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      const result = await model.generateContent([
  {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image,
    },
  },

  `
อ่านข้อความจากสลิปนี้

ดึงข้อมูล:
- จำนวนเงิน
- ร้านค้า
- หมวดหมู่

ตอบ JSON เท่านั้น

{
  "amount": number,
  "merchant": string,
  "category": string
}

กฎ:
- amount ต้องเป็นตัวเลขเท่านั้น
- category เลือกได้:
Food
Transport
Shopping
Bills
Coffee
Travel
Health
Other
`,
]);

      const text = result.response.text();

      console.log(text);

      const raw = result.response.text();

const cleaned = raw
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

let parsed;

try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  console.error(cleaned);

  return Response.json({
    error: "AI parse failed",
  });
}

      await prisma.expense.create({
        data: {
          amount: parsed.amount,
          merchant: parsed.merchant,
          category: parsed.category,
          rawText: text,
        },
      });

      // reply line
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text:
  `✦ Expense Saved\n\n` +
  `${parsed.merchant}\n` +
  `฿${parsed.amount}\n` +
  `${parsed.category}`
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);

    return Response.json(
      { error: "failed" },
      { status: 500 }
    );
  }
}