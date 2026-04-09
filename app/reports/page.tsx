"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import AuthGuard from "../components/auth-guard";

type Expense = {
  id: number | string;
  store: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
};

const CATEGORY_ICONS: Record<string, string> = {
  مطاعم: "🍽️", قهوة: "☕", بنزين: "⛽", سوبرماركت: "🛒",
  تسوق: "🛍️", صحة: "🏥", فواتير: "💡", أخرى: "💳",
};

const MONTH_NAMES = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function toNumber(v: number | string | null): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

/* آخر N شهر */
function lastNMonths(n: number) {
  const result: { year: number; month: number; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES[d.getMonth()]! });
  }
  return result;
}

export default function ReportsPage() {
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear]   = useState<number>(new Date().getFullYear());

  useEffect(() => { void fetchExpenses(); }, []);

  async function fetchExpenses() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    /* جلب آخر 6 أشهر */
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const { data } = await supabase
      .from("expenses")
      .select("id,store,amount,date,category")
      .eq("user_id", user.id)
      .gte("date", sixMonthsAgo.toISOString().split("T")[0]!)
      .order("date", { ascending: true });

    setExpenses(data ?? []);
    setLoading(false);
  }

  const months = lastNMonths(6);

  /* إجماليات كل شهر */
  const monthlyTotals = months.map(({ year, month }) => {
    const total = expenses
      .filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, e) => sum + toNumber(e.amount), 0);
    return { year, month, label: MONTH_NAMES[month]!, total };
  });

  const maxMonthly = Math.max(...monthlyTotals.map((m) => m.total), 1);

  /* مصاريف الشهر المحدد */
  const selectedExpenses = expenses.filter((e) => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const selectedTotal = selectedExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);

  /* تصنيفات الشهر المحدد */
  const categoryStats = selectedExpenses.reduce<Record<string, { total: number; count: number }>>((acc, e) => {
    const cat = e.category ?? "أخرى";
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat]!.total += toNumber(e.amount);
    acc[cat]!.count += 1;
    return acc;
  }, {});
  const sortedCats = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total);

  /* أكثر متاجر */
  const storeStats = selectedExpenses.reduce<Record<string, { total: number; count: number }>>((acc, e) => {
    const s = e.store ?? "غير محدد";
    if (!acc[s]) acc[s] = { total: 0, count: 0 };
    acc[s]!.total += toNumber(e.amount);
    acc[s]!.count += 1;
    return acc;
  }, {});
  const topStores = Object.entries(storeStats).sort((a, b) => b[1].total - a[1].total).slice(0, 5);

  /* مقارنة مع الشهر السابق */
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear  = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevTotal = expenses
    .filter((e) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    })
    .reduce((sum, e) => sum + toNumber(e.amount), 0);

  const diff = selectedTotal - prevTotal;
  const diffPct = prevTotal > 0 ? Math.abs((diff / prevTotal) * 100) : null;

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#1D9E75] px-4 py-8 font-sans">
        <div className="mx-auto w-full max-w-xl space-y-4">

          {/* Header */}
          <header className="flex items-center justify-between">
            <h1 className="text-3xl font-extrabold text-white">📊 التقارير</h1>
            <Link href="/" className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white">
              ← الرئيسية
            </Link>
          </header>

          {loading ? (
            <div className="flex justify-center py-20">
              <span className="size-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
            </div>
          ) : (
            <>
              {/* ── مخطط الأشهر الستة ── */}
              <div className="rounded-3xl bg-white p-5 shadow-lg">
                <p className="mb-4 text-sm font-bold text-gray-500">الإنفاق خلال 6 أشهر</p>
                <div className="flex items-end justify-between gap-1.5 h-36">
                  {monthlyTotals.map(({ year, month, label, total }) => {
                    const heightPct = maxMonthly > 0 ? (total / maxMonthly) * 100 : 0;
                    const isSelected = month === selectedMonth && year === selectedYear;
                    return (
                      <button
                        key={`${year}-${month}`}
                        type="button"
                        onClick={() => { setSelectedMonth(month); setSelectedYear(year); }}
                        className="flex flex-1 flex-col items-center gap-1 group"
                      >
                        {/* القيمة */}
                        <span className={`text-xs font-bold transition-colors ${isSelected ? "text-[#1D9E75]" : "text-gray-300"}`}>
                          {total > 0 ? total.toFixed(0) : ""}
                        </span>
                        {/* الشريط */}
                        <div className="w-full flex items-end justify-center" style={{ height: "90px" }}>
                          <div
                            className={`w-full rounded-t-xl transition-all ${isSelected ? "bg-[#1D9E75]" : "bg-[#1D9E75]/20 group-hover:bg-[#1D9E75]/40"}`}
                            style={{ height: `${Math.max(heightPct, total > 0 ? 5 : 0)}%` }}
                          />
                        </div>
                        {/* الشهر */}
                        <span className={`text-xs font-semibold ${isSelected ? "text-[#1D9E75]" : "text-gray-400"}`}>
                          {label.slice(0, 3)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-xs text-gray-400">اضغط على أي شهر لعرض تفاصيله</p>
              </div>

              {/* ── ملخص الشهر المحدد ── */}
              <div className="rounded-3xl bg-white p-5 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">{MONTH_NAMES[selectedMonth]}</p>
                    <p className="text-4xl font-extrabold text-[#1D9E75]">
                      {selectedTotal.toFixed(2)}
                      <span className="mr-1 text-lg font-semibold text-gray-400">ر.س</span>
                    </p>
                  </div>
                  {/* مقارنة مع الشهر السابق */}
                  {prevTotal > 0 && (
                    <div className={`rounded-2xl px-3 py-2 text-center ${diff > 0 ? "bg-red-50" : "bg-green-50"}`}>
                      <p className={`text-lg font-extrabold ${diff > 0 ? "text-red-500" : "text-green-600"}`}>
                        {diff > 0 ? "▲" : "▼"} {diffPct?.toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-400">مقارنة بـ {MONTH_NAMES[prevMonth]}</p>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">{selectedExpenses.length} عملية</p>
              </div>

              {/* ── التصنيفات ── */}
              {sortedCats.length > 0 && (
                <div className="rounded-3xl bg-white p-5 shadow-lg space-y-3">
                  <p className="text-sm font-bold text-gray-500">الإنفاق حسب التصنيف</p>
                  {sortedCats.map(([cat, { total, count }]) => {
                    const pct = selectedTotal > 0 ? (total / selectedTotal) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span>{CATEGORY_ICONS[cat] ?? "💳"}</span>
                            <span className="text-sm font-semibold text-gray-700">{cat}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{count}×</span>
                          </div>
                          <span className="text-sm font-extrabold text-[#1D9E75]">
                            {total.toFixed(2)} <span className="text-xs font-normal text-gray-400">ر.س</span>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-[#1D9E75] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-right text-xs text-gray-400">{pct.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── أكثر المتاجر ── */}
              {topStores.length > 0 && (
                <div className="rounded-3xl bg-white p-5 shadow-lg space-y-3">
                  <p className="text-sm font-bold text-gray-500">أكثر المتاجر إنفاقاً</p>
                  {topStores.map(([store, { total, count }], i) => (
                    <div key={store} className="flex items-center gap-3">
                      <span className={`flex size-7 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                        i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-orange-300"
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{store}</p>
                        <p className="text-xs text-gray-400">{count} {count === 1 ? "مرة" : "مرات"}</p>
                      </div>
                      <p className="text-sm font-extrabold text-[#1D9E75] shrink-0">
                        {total.toFixed(2)} <span className="text-xs font-normal text-gray-400">ر.س</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* حالة فارغة */}
              {selectedExpenses.length === 0 && (
                <div className="rounded-3xl bg-white p-8 text-center shadow-lg">
                  <p className="text-4xl">📭</p>
                  <p className="mt-3 font-semibold text-gray-600">لا توجد مصاريف في {MONTH_NAMES[selectedMonth]}</p>
                  <Link href="/add" className="mt-4 inline-block rounded-2xl bg-[#1D9E75] px-6 py-3 text-sm font-bold text-white">
                    + أضف مصروف
                  </Link>
                </div>
              )}

            </>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
