"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { apiUrl } from "../lib/api-client";
import BottomNav from "./components/bottom-nav";

type RecentExpense = {
  id: number | string;
  store: string | null;
  amount: number | string | null;
  date: string | null;
  category: string | null;
};

const CATEGORY_ICONS: Record<string, string> = {
  مطاعم: "🍽️", قهوة: "☕", بنزين: "⛽", سوبرماركت: "🛒",
  تسوق: "🛍️", صحة: "🏥", فواتير: "💡", أخرى: "💳",
};

function toNumber(v: number | string | null): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date(new Date().toLocaleString("en-CA", { timeZone: "Asia/Riyadh", hour12: false }));
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return d.toLocaleDateString("ar-EG-u-nu-latn", { month: "short", day: "numeric", calendar: "gregory", timeZone: "Asia/Riyadh" });
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn]       = useState(false);
  const [userName, setUserName]           = useState<string | null>(null);
  const [expenseCount, setExpenseCount]   = useState<number | null>(null);
  const [monthTotal, setMonthTotal]       = useState<number | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [loading, setLoading]             = useState(true);
  const [deletingId, setDeletingId]       = useState<number | string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsLoggedIn(true);
        const meta = data.session.user.user_metadata as Record<string, string> | undefined;
        setUserName(meta?.["full_name"] ?? meta?.["name"] ?? data.session.user.email?.split("@")[0] ?? null);
        void loadData(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        const meta = session.user.user_metadata as Record<string, string> | undefined;
        setUserName(meta?.["full_name"] ?? meta?.["name"] ?? session.user.email?.split("@")[0] ?? null);
        void loadData(session.user.id);
      } else {
        setUserName(null);
        setExpenseCount(null);
        setMonthTotal(null);
        setRecentExpenses([]);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleDeleteRecent(id: number | string) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = session?.access_token
        ? { "Authorization": `Bearer ${session.access_token}` } : {};
      const res = await fetch(apiUrl(`/api/delete?id=${id}`), { method: "DELETE", headers });
      if (res.ok) {
        setRecentExpenses((prev) => prev.filter((e) => e.id !== id));
        setExpenseCount((prev) => (prev !== null ? prev - 1 : null));
        setMonthTotal((prev) => {
          const deleted = recentExpenses.find((e) => e.id === id);
          return prev !== null && deleted ? prev - toNumber(deleted.amount) : prev;
        });
      }
    } catch { /* تجاهل */ }
    finally { setDeletingId(null); }
  }

  async function loadData(userId: string) {
    setLoading(true);

    /* عدد المصاريف الكلي */
    const { count } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    setExpenseCount(count ?? 0);

    /* آخر 5 مصاريف */
    const { data: recent } = await supabase
      .from("expenses")
      .select("id,store,amount,date,category")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5);
    setRecentExpenses(recent ?? []);

    /* إجمالي الشهر الحالي — نص "YYYY-MM" بتوقيت السعودية */
    const todaySAStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }); // "2026-04-09"
    const monthStart = todaySAStr.slice(0, 7) + "-01"; // "2026-04-01"
    const { data: monthData } = await supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", userId)
      .gte("date", monthStart);
    const total = (monthData ?? []).reduce((s, e) => s + toNumber(e.amount), 0);
    setMonthTotal(total);

    setLoading(false);
  }

  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const nowSAStr2 = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }); // "2026-04-09"
  const currentMonthName = monthNames[parseInt(nowSAStr2.slice(5, 7)) - 1];

  /* غير مسجل دخول */
  if (!isLoggedIn && !loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#1D9E75] px-6 py-10 font-sans">
        <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="grid size-20 place-items-center rounded-2xl bg-white shadow-lg">
              <span className="text-3xl font-extrabold text-[#1D9E75]">ف</span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-white">فطين</h1>
            <p className="text-sm font-medium text-white/70">افهم مصاريفك بدون ما تكتب ولا ريال</p>
          </div>
          <Link
            href="/login"
            className="w-full rounded-2xl bg-white px-6 py-4 text-lg font-bold text-[#1D9E75] shadow transition-opacity hover:opacity-90"
          >
            ابدأ مع Google →
          </Link>
          <p className="text-xs text-white/50">🔒 معلوماتك سرية ولا تُشارك مع أي طرف</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#1D9E75] font-sans pb-28">

        {/* Header */}
        <div className="px-5 pt-10 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">أهلاً،</p>
              <h1 className="text-2xl font-extrabold text-white">
                {loading ? "..." : (userName ?? "المستخدم")}
              </h1>
            </div>
            <div className="grid size-10 place-items-center rounded-xl bg-white/20">
              <span className="text-lg font-extrabold text-white">ف</span>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-4 mx-auto max-w-xl">

          {/* بطاقة الشهر */}
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <p className="text-xs font-semibold text-gray-400">إجمالي {currentMonthName}</p>
            {loading ? (
              <div className="mt-2 h-10 w-40 animate-pulse rounded-xl bg-gray-100" />
            ) : (
              <p className="mt-1 text-4xl font-extrabold text-[#1D9E75]">
                {(monthTotal ?? 0).toFixed(2)}
                <span className="mr-1 text-base font-semibold text-gray-400">ر.س</span>
              </p>
            )}
            {!loading && expenseCount !== null && (
              <p className="mt-1 text-xs text-gray-400">{expenseCount} مصروف مسجّل</p>
            )}

            {/* مستخدم جديد */}
            {!loading && expenseCount === 0 && (
              <div className="mt-4 rounded-2xl bg-[#1D9E75]/8 border border-[#1D9E75]/20 px-4 py-3">
                <p className="text-sm font-bold text-[#1D9E75]">🚀 ابدأ بتسجيل أول مصروف</p>
                <p className="mt-0.5 text-xs text-gray-500">ارفع صورة فاتورة أو الصق رسالة بنكية</p>
              </div>
            )}
          </div>

          {/* زر إضافة سريعة */}
          <Link
            href="/add"
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-white py-4 text-lg font-bold text-[#1D9E75] shadow-lg transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <span className="text-xl">📸</span>
            أضف مصروف جديد
          </Link>

          {/* آخر المصاريف */}
          {!loading && recentExpenses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-bold text-white">آخر المصاريف</p>
                <Link href="/expenses" className="text-xs font-semibold text-white/70 underline underline-offset-2">
                  عرض الكل
                </Link>
              </div>

              {recentExpenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow">
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#1D9E75]/10 text-xl">
                    {CATEGORY_ICONS[e.category ?? "أخرى"] ?? "💳"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-800">{e.store ?? "غير محدد"}</p>
                    <p className="text-xs text-gray-400">{e.category ?? "-"} · {formatDateShort(e.date)}</p>
                  </div>
                  <p className="text-sm font-extrabold text-[#1D9E75] flex-shrink-0">
                    {toNumber(e.amount).toFixed(2)}
                    <span className="mr-0.5 text-xs font-normal text-gray-400">ر.س</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteRecent(e.id)}
                    disabled={deletingId === e.id}
                    className="flex-shrink-0 rounded-xl p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
                  >
                    {deletingId === e.id ? "⏳" : "🗑"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/30" />
              ))}
            </div>
          )}

        </div>

        {/* توقيع المطور */}
        <p className="mt-8 pb-2 text-center text-xs text-white/40">
          تصميم وتطوير{" "}
          <span className="font-bold text-white/60">ياسر المنجم</span>
        </p>

      </main>
      <BottomNav />
    </>
  );
}
