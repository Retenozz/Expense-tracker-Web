import axios from "axios";
import { prisma } from "@/lib/prisma";
import { getOrCreatePersonalUser } from "@/lib/auth";
import {
  formatExpenseSavedMessage,
  parseExpenseFromImage,
  parseExpenseFromText,
} from "@/lib/expense-ai";

async function replyToLine(replyToken: string, text: string) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: [
        {
          type: "text",
          text,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = body.events?.[0];

    if (!event) {
      return Response.json({ ok: true });
    }

    const personalUser = await getOrCreatePersonalUser(event.source?.userId);

    if (event.message?.type === "text") {
      try {
        const text = event.message.text ?? "";
        const parsed = await parseExpenseFromText(text);

        await prisma.expense.create({
          data: {
            userId: personalUser.id,
            amount: parsed.amount,
            merchant: parsed.merchant,
            category: parsed.category,
            rawText: parsed.sourceText || text,
          },
        });

        await replyToLine(
          event.replyToken,
          formatExpenseSavedMessage(parsed, parsed.sourceText)
        );
      } catch (error) {
        console.error(error);

        await replyToLine(
          event.replyToken,
          "ยังบันทึกรายการนี้ไม่ได้ ลองพิมพ์แบบ 'ค่าน้ำ 35' หรือ 'กาแฟ Amazon 65'"
        );
      }

      return Response.json({ ok: true });
    }

    if (event.message?.type === "image") {
      try {
        const messageId = event.message.id;
        const imageRes = await axios.get(
          `https://api-data.line.me/v2/bot/message/${messageId}/content`,
          {
            responseType: "arraybuffer",
            headers: {
              Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
          }
        );

        const base64Image = Buffer.from(imageRes.data).toString("base64");
        const parsed = await parseExpenseFromImage(base64Image);

        await prisma.expense.create({
          data: {
            userId: personalUser.id,
            amount: parsed.amount,
            merchant: parsed.merchant,
            category: parsed.category,
            rawText: parsed.sourceText || "รูปภาพใบเสร็จ",
          },
        });

        await replyToLine(
          event.replyToken,
          formatExpenseSavedMessage(parsed, parsed.sourceText)
        );
      } catch (error) {
        console.error(error);

        await replyToLine(
          event.replyToken,
          "อ่านข้อความจากรูปยังไม่สำเร็จ ลองส่งรูปที่ชัดขึ้นหรือพิมพ์ข้อความแทนได้เลย"
        );
      }

      return Response.json({ ok: true });
    }

    if (event.replyToken) {
      await replyToLine(
        event.replyToken,
        "ตอนนี้รองรับข้อความรายจ่ายและรูปใบเสร็จแล้ว และจะผูกข้อมูลไว้กับผู้ใช้ LINE อัตโนมัติ"
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);

    return Response.json({ error: "failed" }, { status: 500 });
  }
}
