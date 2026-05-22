"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  Bell,
  Bot,
  CalendarClock,
  Download,
  LoaderCircle,
  ReceiptText,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserRound,
  Wallet,
} from "lucide-react";

type Expense = {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  rawText: string;
  createdAt: string;
};

type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  lineUserId: string | null;
  monthlyBudget: number;
  notificationEnabled: boolean;
};

type RecurringSubscription = {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  nextBillingDate: string;
  note: string;
  isActive: boolean;
  createdAt: string;
};

const CATEGORY_COLORS = [
  "#0f766e",
  "#f97316",
  "#0f172a",
  "#dc2626",
  "#4338ca",
  "#1d4ed8",
  "#15803d",
  "#7c3aed",
];

const QUICK_ACTIONS = [
  "ค่าน้ำ 35",
  "ค่าเน็ต 599",
  "เดือนนี้ใช้ไปเท่าไหร่",
  "รายการแพงสุด",
];

const COACH_PROMPTS = [
  "ช่วยดูว่าควรลดรายจ่ายตรงไหนก่อน",
  "fixed cost ตอนนี้หนักไปไหม",
  "ช่วยวางแผนเงินสำหรับเดือนหน้า",
];

const ASK_KEYWORDS = [
  "เท่าไหร่",
  "ทั้งหมด",
  "สรุป",
  "กี่",
  "แพงสุด",
  "สูงสุด",
  "เดือนนี้",
  "หมวด",
  "รายการ",
  "total",
  "summary",
  "highest",
];

const DEFAULT_SUBSCRIPTION_FORM = {
  name: "",
  amount: "",
  category: "Bills",
  frequency: "MONTHLY" as RecurringSubscription["frequency"],
  nextBillingDate: new Date().toISOString().slice(0, 10),
  note: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getMonthWindow(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function frequencyLabel(frequency: RecurringSubscription["frequency"]) {
  if (frequency === "WEEKLY") {
    return "รายสัปดาห์";
  }

  if (frequency === "YEARLY") {
    return "รายปี";
  }

  return "รายเดือน";
}

function looksLikeExpenseEntry(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!/\d/.test(normalized)) {
    return false;
  }

  return !ASK_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function getAssistantAnswer(
  expenses: Expense[],
  question: string,
  visibleCategories: number
) {
  const q = question.toLowerCase().trim();
  const { start, end } = getMonthWindow();
  const monthExpenses = expenses.filter((expense) => {
    const createdAt = new Date(expense.createdAt);
    return createdAt >= start && createdAt < end;
  });

  if (q.includes("เดือนนี้")) {
    const total = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    return `เดือนนี้ใช้ไป ${formatCurrency(total)} จาก ${monthExpenses.length} รายการ`;
  }

  if (q.includes("ทั้งหมด") || q.includes("ใช้เงิน") || q.includes("total")) {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    return `ตอนนี้มีรายจ่ายสะสมทั้งหมด ${formatCurrency(total)}`;
  }

  if (q.includes("แพงสุด") || q.includes("สูงสุด") || q.includes("highest")) {
    if (expenses.length === 0) {
      return "ยังไม่มีรายการให้สรุปครับ";
    }

    const highest = expenses.reduce((max, expense) =>
      expense.amount > max.amount ? expense : max
    );

    return `รายการแพงสุดคือ ${highest.merchant} ${formatCurrency(highest.amount)}`;
  }

  if (q.includes("หมวด")) {
    return `ตอนนี้มีหมวดค่าใช้จ่ายอยู่ ${visibleCategories} หมวด`;
  }

  if (q.includes("รายการ")) {
    return `มีรายการทั้งหมด ${expenses.length} รายการ`;
  }

  return "ลองถามแบบ เดือนนี้ใช้ไปเท่าไหร่, รายการแพงสุด, หมวด หรือจำนวนรายการได้ครับ";
}

function LoadingCard() {
  return (
    <div className="animate-pulse rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
      <div className="h-3 w-24 rounded-full bg-slate-200" />
      <div className="mt-4 h-8 w-40 rounded-full bg-slate-200" />
      <div className="mt-6 h-24 rounded-[1.5rem] bg-slate-100" />
    </div>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subscriptions, setSubscriptions] = useState<RecurringSubscription[]>([]);
  const [insight, setInsight] = useState("กำลังโหลดคำแนะนำ...");
  const [coachReply, setCoachReply] = useState("โค้ชการเงินพร้อมช่วยวิเคราะห์ข้อมูลของคุณ");
  const [composer, setComposer] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [coachQuestion, setCoachQuestion] = useState("");
  const [subscriptionForm, setSubscriptionForm] = useState(DEFAULT_SUBSCRIPTION_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [coachPending, setCoachPending] = useState(false);
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "default" : Notification.permission
  );

  async function loadDashboardData() {
    setLoadingDashboard(true);

    try {
      const [expensesResponse, insightResponse, subscriptionsResponse] =
        await Promise.all([
          fetch("/api/expenses", { cache: "no-store" }),
          fetch("/api/insight", { cache: "no-store" }),
          fetch("/api/subscriptions", { cache: "no-store" }),
        ]);

      if (expensesResponse.status === 401) {
        setExpenses([]);
        setSubscriptions([]);
        setInsight("ยังเปิดข้อมูลส่วนตัวไม่สำเร็จ ลองรีเฟรชอีกครั้งครับ");
        return;
      }

      const [expenseData, insightData, subscriptionData] = await Promise.all([
        expensesResponse.json(),
        insightResponse.json(),
        subscriptionsResponse.json(),
      ]);

      setExpenses(expenseData as Expense[]);
      setSubscriptions(subscriptionData as RecurringSubscription[]);
      setInsight((insightData as { text?: string }).text || "ยังไม่มี insight ในตอนนี้");
    } catch (error) {
      console.error(error);
      setInsight("ยังโหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้งครับ");
    } finally {
      setLoadingDashboard(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json())
      .then(async (data: { user: SessionUser | null }) => {
        if (cancelled) {
          return;
        }

        setUser(data.user);
        if (data.user) {
          await loadDashboardData();
        } else {
          setCoachReply("กำลังเตรียมพื้นที่ส่วนตัวให้คุณ");
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingApp(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    }
  }, []);

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [expenses]
  );

  const categories = useMemo(
    () => Array.from(new Set(sortedExpenses.map((expense) => expense.category))).sort(),
    [sortedExpenses]
  );

  const filteredExpenses = useMemo(() => {
    if (activeCategory === "All") {
      return sortedExpenses;
    }

    return sortedExpenses.filter((expense) => expense.category === activeCategory);
  }, [activeCategory, sortedExpenses]);

  const { start, end } = getMonthWindow();
  const thisMonthFilteredExpenses = useMemo(
    () =>
      filteredExpenses.filter((expense) => {
        const createdAt = new Date(expense.createdAt);
        return createdAt >= start && createdAt < end;
      }),
    [end, filteredExpenses, start]
  );

  const monthTotal = useMemo(
    () => thisMonthFilteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [thisMonthFilteredExpenses]
  );

  const averageExpense = useMemo(() => {
    if (thisMonthFilteredExpenses.length === 0) {
      return 0;
    }

    return monthTotal / thisMonthFilteredExpenses.length;
  }, [monthTotal, thisMonthFilteredExpenses.length]);

  const categoryData = useMemo(() => {
    const grouped = filteredExpenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const trendData = useMemo(() => {
    const grouped = thisMonthFilteredExpenses
      .slice()
      .reverse()
      .reduce<Record<string, { label: string; amount: number }>>((acc, expense) => {
        const date = new Date(expense.createdAt);
        const key = date.toISOString().slice(0, 10);
        const label = new Intl.DateTimeFormat("th-TH", {
          day: "numeric",
          month: "short",
        }).format(date);

        if (!acc[key]) {
          acc[key] = { label, amount: 0 };
        }

        acc[key].amount += expense.amount;
        return acc;
      }, {});

    return Object.values(grouped);
  }, [thisMonthFilteredExpenses]);

  const activeSubscriptions = useMemo(
    () =>
      subscriptions
        .filter((subscription) => subscription.isActive)
        .sort(
          (a, b) =>
            new Date(a.nextBillingDate).getTime() -
            new Date(b.nextBillingDate).getTime()
        ),
    [subscriptions]
  );

  const monthlySubscriptionLoad = useMemo(() => {
    return activeSubscriptions.reduce((sum, subscription) => {
      if (subscription.frequency === "YEARLY") {
        return sum + subscription.amount / 12;
      }

      if (subscription.frequency === "WEEKLY") {
        return sum + subscription.amount * 4;
      }

      return sum + subscription.amount;
    }, 0);
  }, [activeSubscriptions]);

  const budgetUsage =
    user && user.monthlyBudget > 0 ? monthTotal / user.monthlyBudget : 0;
  const budgetWarning =
    budgetUsage >= 1
      ? "เกินงบรายเดือนแล้ว ลองเช็กหมวดที่ใช้บ่อยที่สุดกับ fixed cost ก่อน"
      : budgetUsage >= 0.8
        ? "แตะ 80% ของงบแล้ว ช่วงที่เหลือของเดือนควรคุมรายจ่ายเพิ่มอีกนิด"
        : "ยังอยู่ในโซนปลอดภัยของงบรายเดือน";

  const largestExpense = sortedExpenses[0]
    ? sortedExpenses.reduce((max, expense) =>
        expense.amount > max.amount ? expense : max
      )
    : null;

  useEffect(() => {
    if (!user || !user.notificationEnabled || notificationPermission !== "granted") {
      return;
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `expense-notification-${user.id}-${todayKey}`;

    if (window.localStorage.getItem(storageKey)) {
      return;
    }

    const nextDue = activeSubscriptions[0];
    if (budgetUsage < 1 && !nextDue) {
      return;
    }

    void navigator.serviceWorker.ready
      .then((registration) =>
        registration.showNotification("AI Expense Tracker", {
          body:
            budgetUsage >= 1
              ? "งบเดือนนี้เกินแล้ว ลองเปิดแอปมาเช็กหมวดที่ใช้หนักที่สุด"
              : `มี recurring subscription ใกล้ถึงรอบ: ${nextDue.name}`,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: {
            url: "/",
          },
        })
      )
      .then(() => {
        window.localStorage.setItem(storageKey, "sent");
      })
      .catch((error) => {
        console.error(error);
      });
  }, [activeSubscriptions, budgetUsage, notificationPermission, user]);

  async function handleComposerSubmit(prefilledValue?: string) {
    const value = (prefilledValue ?? composer).trim();

    if (!value) {
      return;
    }

    if (!looksLikeExpenseEntry(value)) {
      setAssistantReply(getAssistantAnswer(sortedExpenses, value, categories.length));
      setComposer("");
      return;
    }

    setSubmitPending(true);
    setAssistantReply("");

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: value }),
      });

      const data = (await response.json()) as {
        expense?: Expense;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.expense) {
        throw new Error(data.error || "Unable to add expense");
      }

      setExpenses((current) => [data.expense as Expense, ...current]);
      setAssistantReply(data.message || "เพิ่มรายการเรียบร้อยแล้ว");
      setComposer("");
      await loadDashboardData();
    } catch (error) {
      console.error(error);
      setAssistantReply(
        error instanceof Error
          ? error.message
          : "ยังเพิ่มรายการไม่สำเร็จ ลองพิมพ์แบบ 'ค่าน้ำ 35' อีกครั้งครับ"
      );
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleDelete(id: string) {
    const previous = expenses;
    setDeletingId(id);
    setExpenses((current) => current.filter((expense) => expense.id !== id));

    try {
      const response = await fetch(`/api/expenses?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      setAssistantReply("ลบรายการเรียบร้อยแล้ว");
      await loadDashboardData();
    } catch (error) {
      console.error(error);
      setExpenses(previous);
      setAssistantReply("ลบรายการไม่สำเร็จ ลองอีกครั้งครับ");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBudgetSave(nextBudget: number) {
    if (!user || !Number.isFinite(nextBudget) || nextBudget < 0) {
      return;
    }

    setSettingsPending(true);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ monthlyBudget: nextBudget }),
      });

      const data = (await response.json()) as { user?: SessionUser };
      if (data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSettingsPending(false);
    }
  }

  async function handleCoachSubmit(prefilledQuestion?: string) {
    const question = (prefilledQuestion ?? coachQuestion).trim();
    setCoachPending(true);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Coach unavailable");
      }

      setCoachReply(data.text || "โค้ชยังไม่มีคำตอบตอนนี้");
      setCoachQuestion("");
    } catch (error) {
      console.error(error);
      setCoachReply("โค้ชการเงินยังตอบไม่ได้ตอนนี้ ลองอีกครั้งในอีกสักครู่");
    } finally {
      setCoachPending(false);
    }
  }

  async function handleSubscriptionCreate() {
    setSubscriptionPending(true);

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...subscriptionForm,
          amount: Number(subscriptionForm.amount),
        }),
      });

      const data = (await response.json()) as {
        subscription?: RecurringSubscription;
        error?: string;
      };

      if (!response.ok || !data.subscription) {
        throw new Error(data.error || "Create subscription failed");
      }

      setSubscriptions((current) =>
        [...current, data.subscription as RecurringSubscription].sort(
          (a, b) =>
            new Date(a.nextBillingDate).getTime() -
            new Date(b.nextBillingDate).getTime()
        )
      );
      setSubscriptionForm(DEFAULT_SUBSCRIPTION_FORM);
      await loadDashboardData();
    } catch (error) {
      console.error(error);
      setCoachReply(
        error instanceof Error
          ? error.message
          : "เพิ่ม recurring subscription ไม่สำเร็จ"
      );
    } finally {
      setSubscriptionPending(false);
    }
  }

  async function handleSubscriptionDelete(id: string) {
    const previous = subscriptions;
    setSubscriptions((current) =>
      current.filter((subscription) => subscription.id !== id)
    );

    try {
      await fetch(`/api/subscriptions?id=${id}`, {
        method: "DELETE",
      });
      await loadDashboardData();
    } catch (error) {
      console.error(error);
      setSubscriptions(previous);
    }
  }

  async function handleEnableNotifications() {
    if (typeof Notification === "undefined") {
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: true,
        }),
      });

      setUser((current) =>
        current ? { ...current, notificationEnabled: true } : current
      );

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("AI Expense Tracker", {
        body: "เปิดการแจ้งเตือนเรียบร้อยแล้ว คุณจะได้รับเตือนเรื่องงบและ recurring bills",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url: "/",
        },
      });
    }
  }

  async function handleDisableNotifications() {
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    setUser((current) =>
      current ? { ...current, notificationEnabled: false } : current
    );
  }

  if (loadingApp) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <section className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-8 text-center shadow-[0_30px_120px_-50px_rgba(15,23,42,0.45)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
              กำลังเปิดแดชบอร์ด
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              ถ้าหน้านี้ค้างอยู่ ลองรีเฟรชอีกครั้งครับ
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(240,249,255,0.98)_48%,_rgba(255,247,237,0.98)_100%)] p-6 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.45)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700">
                <Sparkles className="h-4 w-4" />
                AI Expense Tracker Premium
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                สวัสดี {user.name}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                เพิ่มรายจ่าย ดูงบ และคุยกับโค้ชการเงิน
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <UserRound className="h-4 w-4" />
                  {user.lineUserId ? "LINE พร้อมใช้" : "พื้นที่ส่วนตัว"}
                </div>
                <p className="mt-1 text-slate-500">
                  {user.lineUserId ? "ข้อความใน LINE จะเข้าหน้านี้" : "เปิดใช้งานอัตโนมัติ"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Smart input</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">เพิ่มรายการหรือถามสรุปจากกล่องเดียว</h2>
              </div>

              <a
                href="/api/expenses/export"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    setComposer(action);
                    void handleComposerSubmit(action);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {action}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">เพิ่มรายการหรือถามสรุป</span>
                <div className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner shadow-slate-100">
                  {submitPending ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-teal-600" />
                  ) : (
                    <ReceiptText className="h-5 w-5 text-slate-400" />
                  )}

                  <input
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleComposerSubmit();
                      }
                    }}
                    placeholder="เช่น ค่าน้ำ 35, Netflix 349 หรือ เดือนนี้ใช้ไปเท่าไหร่"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={() => void handleComposerSubmit()}
                disabled={submitPending}
                className="inline-flex items-center justify-center rounded-[1.5rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitPending ? "กำลังบันทึก..." : "ส่งคำสั่ง"}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {assistantReply ? (
                <motion.div
                  key={assistantReply}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 rounded-[1.5rem] border border-teal-100 bg-teal-50/90 p-4 text-sm leading-6 text-teal-900"
                >
                  {assistantReply}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-950 p-3 text-white">
                <Wallet className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Budget warning</p>
                <h2 className="text-xl font-semibold text-slate-950">งบของเดือนนี้</h2>
              </div>
            </div>

            <label className="mt-5 block text-sm font-medium text-slate-600">
              ตั้งงบรายเดือน
              <input
                type="number"
                min={0}
                step={100}
                value={user.monthlyBudget}
                onChange={(event) => {
                  const nextBudget = Number(event.target.value) || 0;
                  setUser((current) =>
                    current ? { ...current, monthlyBudget: nextBudget } : current
                  );
                }}
                onBlur={(event) => void handleBudgetSave(Number(event.target.value) || 0)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-950 outline-none transition focus:border-teal-400"
              />
            </label>

            <div className="mt-5 rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">ใช้ไปแล้ว</span>
                <span className="text-sm text-slate-300">
                  {Math.min(100, Math.round(budgetUsage * 100))}%
                </span>
              </div>

              <p className="mt-3 text-3xl font-semibold">{formatCurrency(monthTotal)}</p>
              <p className="mt-1 text-sm text-slate-300">
                จากงบ {formatCurrency(user.monthlyBudget)}
              </p>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${
                    budgetUsage >= 1
                      ? "bg-red-400"
                      : budgetUsage >= 0.8
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, budgetUsage * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-[1.5rem] border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{budgetWarning}</p>
            </div>

            {settingsPending ? (
              <p className="mt-3 text-sm text-slate-500">กำลังบันทึกงบรายเดือน...</p>
            ) : null}
          </div>
        </section>

        {loadingDashboard ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
              <p className="text-sm text-slate-500">สรุปเดือนนี้</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(monthTotal)}</p>
              <p className="mt-2 text-sm text-slate-500">รวมเฉพาะเดือนปัจจุบันในมุมมองที่เลือก</p>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
              <p className="text-sm text-slate-500">ค่าเฉลี่ยต่อรายการ</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(averageExpense)}</p>
              <p className="mt-2 text-sm text-slate-500">จาก {thisMonthFilteredExpenses.length} รายการในเดือนนี้</p>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
              <p className="text-sm text-slate-500">Recurring load</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(monthlySubscriptionLoad)}</p>
              <p className="mt-2 text-sm text-slate-500">fixed cost โดยประมาณต่อเดือน</p>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
              <p className="text-sm text-slate-500">รายการแพงสุด</p>
              <p className="mt-3 line-clamp-1 text-2xl font-semibold text-slate-950">
                {largestExpense?.merchant || "ยังไม่มีข้อมูล"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {largestExpense ? formatCurrency(largestExpense.amount) : "รอข้อมูลรายการ"}
              </p>
            </div>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-6">
            <div>
              <p className="text-sm font-medium text-slate-500">AI financial coach</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">โค้ชส่วนตัวที่ดูทั้งรายจ่ายและ recurring bills</h2>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {COACH_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setCoachQuestion(prompt);
                    void handleCoachSubmit(prompt);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={coachQuestion}
                onChange={(event) => setCoachQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCoachSubmit();
                  }
                }}
                className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="ถามโค้ช เช่น fixed cost หนักไปไหม หรือควรลดหมวดไหนก่อน"
              />

              <button
                type="button"
                onClick={() => void handleCoachSubmit()}
                disabled={coachPending}
                className="inline-flex items-center justify-center rounded-[1.5rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {coachPending ? "กำลังคิด..." : "ถามโค้ช"}
              </button>
            </div>

            <div className="mt-5 rounded-[1.75rem] border border-teal-100 bg-teal-50/90 p-5 text-sm leading-7 text-teal-950">
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <Bot className="h-4 w-4" />
                AI coach response
              </div>
              {coachReply}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                <Bell className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Notifications</p>
                <h2 className="text-2xl font-semibold text-slate-950">แจ้งเตือน</h2>
              </div>
            </div>

            <div className="mt-5">
              {user.notificationEnabled ? (
                <button
                  type="button"
                  onClick={() => void handleDisableNotifications()}
                  className="inline-flex items-center justify-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" />
                  ปิดการแจ้งเตือน
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleEnableNotifications()}
                  className="inline-flex items-center justify-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" />
                  เปิดการแจ้งเตือน
                </button>
              )}
            </div>

            <p className="mt-4 text-sm text-slate-500">
              สถานะ notification: {notificationPermission} {user.notificationEnabled ? "• เปิดใช้งานแล้ว" : "• ยังไม่เปิด"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Monthly summary</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">แนวโน้มรายจ่ายรายวัน</h2>
              </div>
            </div>

            <div className="mt-5 h-72">
              {trendData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  ยังไม่มีข้อมูลของเดือนนี้สำหรับวาดกราฟ
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), "รายจ่าย"]}
                      contentStyle={{
                        borderRadius: "18px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 20px 50px -30px rgba(15, 23, 42, 0.35)",
                      }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={3} fill="url(#trendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-6">
            <div>
              <p className="text-sm font-medium text-slate-500">Category filter</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">ดูเฉพาะหมวดที่ต้องการ</h2>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {["All", ...categories].map((category) => {
                const active = activeCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-slate-950 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {category === "All" ? "ทั้งหมด" : category}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 h-72">
              {categoryData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  ยังไม่มีข้อมูลในหมวดนี้
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {categoryData.map((category, index) => (
                        <Cell
                          key={category.name}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), "รวม"]}
                      contentStyle={{
                        borderRadius: "18px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 20px 50px -30px rgba(15, 23, 42, 0.35)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categoryData.map((category, index) => (
                <div
                  key={category.name}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  />
                  {category.name} {formatCurrency(category.value)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                <CalendarClock className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Recurring subscriptions</p>
                <h2 className="text-2xl font-semibold text-slate-950">จัดการรายจ่ายประจำ</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                value={subscriptionForm.name}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="เช่น Netflix"
              />
              <input
                type="number"
                value={subscriptionForm.amount}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="จำนวนเงิน"
              />
              <input
                value={subscriptionForm.category}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="หมวด"
              />
              <select
                value={subscriptionForm.frequency}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    frequency: event.target.value as RecurringSubscription["frequency"],
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
              >
                <option value="MONTHLY">รายเดือน</option>
                <option value="WEEKLY">รายสัปดาห์</option>
                <option value="YEARLY">รายปี</option>
              </select>
              <input
                type="date"
                value={subscriptionForm.nextBillingDate}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    nextBillingDate: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
              />
              <input
                value={subscriptionForm.note}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-400"
                placeholder="โน้ตเพิ่มเติม"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleSubscriptionCreate()}
              disabled={subscriptionPending}
              className="mt-4 inline-flex items-center justify-center rounded-[1.5rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {subscriptionPending ? "กำลังเพิ่ม..." : "เพิ่ม recurring subscription"}
            </button>

            <div className="mt-5 space-y-3">
              {activeSubscriptions.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                  ยังไม่มี recurring subscription ลองเพิ่มค่าใช้จ่ายประจำอย่าง Netflix, ค่าเช่า หรือค่าเน็ต
                </div>
              ) : (
                activeSubscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-950">{subscription.name}</p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {frequencyLabel(subscription.frequency)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        รอบถัดไป {formatDate(subscription.nextBillingDate)} • {subscription.category}
                      </p>
                      {subscription.note ? (
                        <p className="mt-2 text-sm text-slate-400">{subscription.note}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-slate-950">
                        {formatCurrency(subscription.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleSubscriptionDelete(subscription.id)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 p-3 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                <Bot className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">AI insight</p>
                <h2 className="text-2xl font-semibold text-slate-950">สรุปพฤติกรรมการใช้เงินล่าสุด</h2>
              </div>
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 text-base leading-7 text-slate-700">
              {insight}
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-slate-500">รายการล่าสุด</p>
              <div className="mt-3 space-y-3">
                {filteredExpenses.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                    <p className="text-lg font-semibold text-slate-900">ยังไม่มีรายการให้แสดง</p>
                    <p className="mt-2 text-sm text-slate-500">
                      ลองเพิ่มรายการแรกด้วยข้อความอย่าง ค่าน้ำ 35 หรือส่งรูปใบเสร็จผ่าน LINE
                    </p>
                  </div>
                ) : (
                  filteredExpenses.map((expense) => (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-lg font-semibold text-slate-950">
                            {expense.merchant}
                          </p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {expense.category}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">{formatDate(expense.createdAt)}</p>
                        {expense.rawText ? (
                          <p className="mt-2 line-clamp-1 text-sm text-slate-400">
                            ต้นฉบับ: {expense.rawText}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <p className="text-xl font-semibold text-slate-950">
                          {formatCurrency(expense.amount)}
                        </p>

                        <button
                          type="button"
                          onClick={() => void handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 p-3 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === expense.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
