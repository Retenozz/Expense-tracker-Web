"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  TrendingDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
type Expense = {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  createdAt: string;
};

export default function HomePage() {
  const [expenses, setExpenses] = useState<
    Expense[]
  >([]);

  const [insight, setInsight] =
  useState("Loading insight...");

  const [question, setQuestion] =
  useState("");

const [answer, setAnswer] =
  useState("");
  


  useEffect(() => {
  fetch("/api/expenses")
    .then((res) => res.json())
    .then(setExpenses);

  fetch("/api/insight")
    .then((res) => res.json())
    .then((data) => setInsight(data.text));
}, []);
function askLocalAI() {
  const q = question.toLowerCase().trim();

  // TOTAL
  if (
    q.includes("ทั้งหมด") ||
    q.includes("ใช้เงิน") ||
    q.includes("total")
  ) {
    const total = expenses.reduce(
      (sum, e) => sum + e.amount,
      0
    );

    setAnswer(
      `คุณใช้เงินทั้งหมด ฿${total.toLocaleString()}`
    );

    setQuestion("");
    return;
  }

  // HIGHEST
  if (
    q.includes("แพงสุด") ||
    q.includes("สูงสุด")
  ) {
    if (expenses.length === 0) {
      setAnswer("ยังไม่มีข้อมูล");
      setQuestion("");
      return;
    }

    const highest = expenses.reduce(
      (max, e) =>
        e.amount > max.amount ? e : max,
      expenses[0]
    );

    setAnswer(
      `รายการแพงสุดคือ ${highest.merchant} ฿${highest.amount}`
    );
    setQuestion("");
    return;
  }

  // COFFEE
  if (
    q.includes("กาแฟ") ||
    q.includes("coffee")
  ) {
    const coffeeTotal = expenses
      .filter(
        (e) =>
          e.category === "Coffee"
      )
      .reduce(
        (sum, e) => sum + e.amount,
        0
      );

    setAnswer(
      `ค่า Coffee ทั้งหมด ฿${coffeeTotal}`
    );

    setQuestion("");
    return;
  }

  // FOOD
  if (
    q.includes("อาหาร") ||
    q.includes("food")
  ) {
    const foodTotal = expenses
      .filter(
        (e) =>
          e.category === "Food"
      )
      .reduce(
        (sum, e) => sum + e.amount,
        0
      );

    setAnswer(
      `ค่าอาหารทั้งหมด ฿${foodTotal}`
    );

    setQuestion("");
    return;
  }

  // CATEGORY COUNT
  if (
    q.includes("หมวด")
  ) {
    setAnswer(
      `มีทั้งหมด ${categoryData.length} หมวด`
    );
    setQuestion("");

    return;
  }

  // TRANSACTION COUNT
  if (
    q.includes("รายการ")
  ) {
    setAnswer(
      `มีรายการทั้งหมด ${expenses.length} รายการ`
    );
    setQuestion("");

    return;
  }

  // DEFAULT
  setAnswer(
    "รองรับเฉพาะ:\n- ใช้เงินทั้งหมด\n- รายการแพงสุด\n- กาแฟ\n- อาหาร\n- จำนวนรายการ"
  );
  setQuestion("");
}

  const total = useMemo(() => {
    return expenses.reduce(
      (sum, item) => sum + item.amount,
      0
    );
  }, [expenses]);

  const chartData = expenses.map((e) => ({
  amount: e.amount,
}));
const categoryData = Object.values(
  expenses.reduce((acc, expense) => {
    if (!acc[expense.category]) {
      acc[expense.category] = {
        name: expense.category,
        value: 0,
      };
    }

    acc[expense.category].value += expense.amount;

    return acc;
  }, {} as Record<string, { name: string; value: number }>)
);

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-neutral-500 text-sm">
              PERSONAL FINANCE
            </p>

            <h1 className="text-4xl font-semibold mt-2">
              Expense Tracker
            </h1>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 flex items-center justify-center">
            <CreditCard size={20} />
          </div>
        </div>

        {/* HERO */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 mb-8 backdrop-blur">
          <p className="text-neutral-400 mb-3">
            Total Spending
          </p>

          <h2 className="text-6xl font-semibold tracking-tight">
            ฿{total.toLocaleString()}
          </h2>

          <div className="flex items-center gap-2 mt-4 text-red-400">
            <TrendingDown size={16} />

            <span className="text-sm">
              synced from LINE AI
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
  <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
    <p className="text-neutral-500 text-sm">
      Transactions
    </p>

    <h3 className="text-3xl font-semibold mt-3">
      {expenses.length}
    </h3>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
    <p className="text-neutral-500 text-sm">
      Largest Expense
    </p>

    <h3 className="text-3xl font-semibold mt-3">
      ฿
      {expenses.reduce(
  (max, e) =>
    e.amount > max ? e.amount : max,
  0
)}
    </h3>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
    <p className="text-neutral-500 text-sm">
      Categories
    </p>

    <h3 className="text-3xl font-semibold mt-3">
      {categoryData.length}
    </h3>
  </div>
</div>
        {/* TREND */}
<div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
  <div className="flex items-center justify-between mb-6">
    <div>
      <p className="text-neutral-400 text-sm">
        Spending Trend
      </p>

      <h3 className="text-2xl font-semibold mt-1">
        Weekly Analytics
      </h3>
    </div>
  </div>

  <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <Area
  type="monotone"
  dataKey="amount"
  stroke="#ffffff"
  fill="#ffffff22"
  strokeWidth={3}
/>
      </AreaChart>
    </ResponsiveContainer>
  </div>
</div>

{/* CATEGORY PIE */}
<div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
  <div className="flex items-center justify-between mb-6">
    <div>
      <p className="text-neutral-400 text-sm">
        Category Breakdown
      </p>

      <h3 className="text-2xl font-semibold mt-1">
        Spending Categories
      </h3>
    </div>
  </div>

  <div className="h-72">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={categoryData}
          dataKey="value"
          nameKey="name"
          outerRadius={100}
        >
          {categoryData.map((_, index) => (
            <Cell
              key={index}
              fill={[
                "#ffffff",
                "#999999",
                "#666666",
                "#444444",
                "#bbbbbb",
              ][index % 5]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  </div>

  <div className="flex flex-wrap gap-2 mt-4">
    {categoryData.map((item) => (
      <div
        key={item.name}
        className="px-3 py-1 rounded-full bg-white/[0.03] backdrop-blur-xl border border-white/10 text-sm text-neutral-300"
      >
        {item.name} • ฿{item.value}
      </div>
    ))}
  </div>
</div>
  {/* AI INSIGHT */}
<div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 mb-8">
  <p className="text-neutral-500 text-sm mb-3">
    AI INSIGHT
  </p>

  <h3 className="text-2xl font-medium leading-relaxed whitespace-pre-line">
    {insight || "Generating insight..."}
  </h3>
</div>



{/* AI CHAT */}
<div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
  <p className="text-neutral-500 text-sm mb-4">
    AI CHAT
  </p>
  <div className="flex flex-wrap gap-2 mb-4">
  {[
    "ใช้เงินทั้งหมด",
    "รายการแพงสุด",
    "กาแฟ",
    "อาหาร",
    "จำนวนรายการ",
  ].map((cmd) => (
    <button
      key={cmd}
      onClick={() => {
  setQuestion(cmd);

  setTimeout(() => {
    const q = cmd.toLowerCase();

    if (
      q.includes("ทั้งหมด") ||
      q.includes("ใช้เงิน")
    ) {
      const total = expenses.reduce(
        (sum, e) => sum + e.amount,
        0
      );

      setAnswer(
        `คุณใช้เงินทั้งหมด ฿${total.toLocaleString()}`
      );

      return;
    }

    askLocalAI();
  }, 0);
}}
      className="
        px-3 py-1
        rounded-full
        border border-white/10
        bg-white/[0.04]
        text-sm
        hover:bg-white/[0.08]
        transition-all
      "
    >
      {cmd}
    </button>
  ))}
</div>

  <div className="flex gap-3">
    <input
  value={question}
  onChange={(e) =>
    setQuestion(e.target.value)
  }
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      askLocalAI();
    }
  }}
      placeholder="ถามเรื่องค่าใช้จ่าย..."
      className="
        flex-1
        bg-white/5
        border border-white/10
        rounded-2xl
        px-4 py-3
        outline-none
      "
    />

    <button
      onClick={askLocalAI}
      className="
        px-5
        rounded-2xl
        bg-white
        text-black
        font-medium
      "
    >
      Ask
    </button>
  </div>

  {answer && (
    <div className="mt-5 text-lg text-neutral-200 whitespace-pre-line">
      {answer}
    </div>
  )}
</div>

        {/* LIST */}
<div className="space-y-3">
  {expenses
  .sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  )
  .map((expense) => (
    <motion.div
      key={expense.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="
        rounded-3xl
        border border-white/10
        bg-gradient-to-b
        from-white/[0.05]
        to-white/[0.02]
        p-5
        flex items-center justify-between
        hover:bg-white/[0.07]
hover:scale-[1.01]
transition-all duration-300
      "
    >
      <div>
        <p className="text-lg font-medium tracking-tight">
          {expense.merchant}
        </p>

        <div className="mt-2 inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-neutral-300">
          {expense.category}
        </div>
        <p className="text-xs text-neutral-500 mt-2">
  {new Date(expense.createdAt).toLocaleDateString()}
</p>
      </div>

      <p className="text-2xl font-semibold tracking-tight">
        ฿{expense.amount}
      </p>
    </motion.div>
  ))}

  {expenses.length === 0 && (
    <div className="text-center py-24 text-neutral-500">
      No expenses yet.
    </div>
  )}
    </div>
    </div> 
    </main>
  );
}