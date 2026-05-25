"use client";

import { Sparkles } from "lucide-react";

export default function LoginPage() {
  const handleLineLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID;
    if (!clientId) {
      alert("LINE Login ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID");
      return;
    }
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/api/auth/line/callback`
    );
    const state = crypto.randomUUID();
    sessionStorage.setItem("line_oauth_state", state);

    const url =
      `https://access.line.me/oauth2/v2.1/authorize` +
      `?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&state=${state}` +
      `&scope=profile%20openid`;

    window.location.href = url;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4">
      <section className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-white/90 p-8 text-center shadow-[0_30px_120px_-50px_rgba(15,23,42,0.45)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <Sparkles className="h-6 w-6" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          AI Expense Tracker
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          ติดตามรายจ่าย วางแผนงบ และรับคำแนะนำจาก AI
        </p>

        <button
          type="button"
          onClick={handleLineLogin}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-[1.25rem] bg-[#06C755] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#05b34c] active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          เข้าสู่ระบบด้วย LINE
        </button>

        <p className="mt-6 text-xs text-slate-400">
          การเข้าสู่ระบบจะผูกบัญชี LINE ของคุณเข้ากับข้อมูลรายจ่ายในระบบ
        </p>
      </section>
    </main>
  );
}
