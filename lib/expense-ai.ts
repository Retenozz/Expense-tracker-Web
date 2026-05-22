import { GoogleGenerativeAI } from "@google/generative-ai";

export const EXPENSE_CATEGORIES = [
  "Food",
  "Coffee",
  "Transport",
  "Shopping",
  "Bills",
  "Travel",
  "Health",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ParsedExpense = {
  amount: number;
  merchant: string;
  category: ExpenseCategory;
  sourceText?: string;
};

type ParsedExpenseCandidate = {
  amount?: number | string | null;
  merchant?: string | null;
  category?: string | null;
  sourceText?: string | null;
};

const categoryKeywords: Record<ExpenseCategory, string[]> = {
  Food: [
    "food",
    "meal",
    "restaurant",
    "lunch",
    "dinner",
    "breakfast",
    "ข้าว",
    "อาหาร",
    "ก๋วยเตี๋ยว",
    "หมูกระทะ",
    "ชาบู",
  ],
  Coffee: [
    "coffee",
    "latte",
    "espresso",
    "cafe",
    "starbucks",
    "กาแฟ",
    "คาเฟ่",
    "ชา",
    "ชาเขียว",
  ],
  Transport: [
    "transport",
    "taxi",
    "grab",
    "uber",
    "bts",
    "mrt",
    "bus",
    "train",
    "flight",
    "toll",
    "fuel",
    "gas",
    "เดินทาง",
    "รถ",
    "แท็กซี่",
    "รถไฟ",
    "น้ำมัน",
    "ทางด่วน",
  ],
  Shopping: [
    "shopping",
    "shopee",
    "lazada",
    "mall",
    "buy",
    "ซื้อ",
    "เสื้อ",
    "ของใช้",
    "ของกินเล่น",
    "ของขวัญ",
  ],
  Bills: [
    "bill",
    "utility",
    "internet",
    "phone",
    "electric",
    "water",
    "rent",
    "invoice",
    "ค่าไฟ",
    "ค่าน้ำ",
    "ค่าเน็ต",
    "ค่าโทร",
    "ค่าเช่า",
    "บิล",
  ],
  Travel: [
    "travel",
    "trip",
    "hotel",
    "booking",
    "เที่ยว",
    "ทริป",
    "โรงแรม",
    "ที่พัก",
    "ตั๋ว",
  ],
  Health: [
    "health",
    "medicine",
    "hospital",
    "clinic",
    "doctor",
    "ยา",
    "หมอ",
    "โรงพยาบาล",
    "คลินิก",
    "วิตามิน",
  ],
  Other: [],
};

let cachedGenAI: GoogleGenerativeAI | null | undefined;

function getGenAI() {
  if (cachedGenAI !== undefined) {
    return cachedGenAI;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  cachedGenAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  return cachedGenAI;
}

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error("No JSON object found in model response.");
  }

  return JSON.parse(match[0]) as ParsedExpenseCandidate;
}

function inferCategory(text: string) {
  const normalized = text.toLowerCase();

  for (const category of EXPENSE_CATEGORIES) {
    if (
      categoryKeywords[category].some((keyword) =>
        normalized.includes(keyword.toLowerCase())
      )
    ) {
      return category;
    }
  }

  return "Other" as ExpenseCategory;
}

function normalizeMerchant(merchant: string | null | undefined, sourceText: string) {
  const cleaned = (merchant ?? "")
    .replace(/\s+/g, " ")
    .replace(/[฿,]/g, "")
    .trim();

  if (cleaned) {
    return cleaned;
  }

  const fallback = sourceText
    .replace(/[\d,.]+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return fallback || "รายการไม่ระบุ";
}

function normalizeAmount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number.parseFloat(value.replace(/,/g, "").trim());
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }

  return null;
}

function normalizeCategory(category: string | null | undefined, sourceText: string) {
  const cleaned = (category ?? "").trim();

  if (EXPENSE_CATEGORIES.includes(cleaned as ExpenseCategory)) {
    return cleaned as ExpenseCategory;
  }

  return inferCategory(`${cleaned} ${sourceText}`);
}

function normalizeParsedExpense(
  candidate: ParsedExpenseCandidate,
  sourceText: string
): ParsedExpense {
  const amount = normalizeAmount(candidate.amount);

  if (!amount || amount <= 0) {
    throw new Error("Unable to detect a valid amount.");
  }

  return {
    amount,
    merchant: normalizeMerchant(candidate.merchant, sourceText),
    category: normalizeCategory(candidate.category, sourceText),
    sourceText: candidate.sourceText?.trim() || sourceText.trim(),
  };
}

function heuristicParseExpenseText(text: string): ParsedExpense | null {
  const matches = text.match(/(\d[\d,]*(?:\.\d{1,2})?)/g);
  const amountText = matches?.at(-1);

  if (!amountText) {
    return null;
  }

  const amount = normalizeAmount(amountText);
  if (!amount || amount <= 0) {
    return null;
  }

  const merchant = text
    .replace(amountText, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!merchant) {
    return null;
  }

  return {
    amount,
    merchant,
    category: inferCategory(text),
    sourceText: text.trim(),
  };
}

export async function parseExpenseFromText(text: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error("Expense text is empty.");
  }

  const heuristic = heuristicParseExpenseText(normalizedText);
  if (heuristic) {
    return heuristic;
  }

  const genAI = getGenAI();
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const result = await model.generateContent(`
Extract expense info from this message and respond with JSON only.

Message:
"${normalizedText}"

JSON schema:
{
  "amount": number,
  "merchant": string,
  "category": "Food" | "Coffee" | "Transport" | "Shopping" | "Bills" | "Travel" | "Health" | "Other"
}

Rules:
- amount must be numeric only.
- merchant should be the most meaningful short label.
- if category is unclear, use Other.
`);

  return normalizeParsedExpense(
    extractJsonObject(result.response.text()),
    normalizedText
  );
}

export async function parseExpenseFromImage(base64Image: string, mimeType = "image/jpeg") {
  const genAI = getGenAI();
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
    `
Read the image, extract the visible text, and return JSON only.

JSON schema:
{
  "sourceText": string,
  "amount": number,
  "merchant": string,
  "category": "Food" | "Coffee" | "Transport" | "Shopping" | "Bills" | "Travel" | "Health" | "Other"
}

Rules:
- sourceText should capture the most relevant text from the receipt/slip.
- amount must be numeric only.
- merchant should be concise and meaningful.
- if category is unclear, use Other.
`,
  ]);

  const parsed = extractJsonObject(result.response.text());
  return normalizeParsedExpense(parsed, parsed.sourceText?.trim() || "รูปภาพใบเสร็จ");
}

export function formatExpenseSavedMessage(expense: ParsedExpense, sourceText?: string) {
  const lines = [
    "บันทึกรายจ่ายแล้ว",
    `${expense.merchant} • ฿${expense.amount.toLocaleString("th-TH")}`,
    expense.category,
  ];

  if (sourceText?.trim()) {
    lines.push(`ข้อความที่อ่านได้: ${sourceText.trim()}`);
  }

  return lines.join("\n");
}
