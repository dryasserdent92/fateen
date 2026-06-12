"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import AuthGuard from "../components/auth-guard";
import BottomNav from "../components/bottom-nav";

type Expense = {
  id: number | string;
  store: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
};

const CATEGORY_ICONS: Record<string, string> = {
  مطاعم: "🍽️", قهوة: "☕",
  بنزيني: "⛽", "بنزين السواق": "🚖", "بنزين عام": "🛢️",
  سوبرماركت: "🛒", تسوق: "🛍️", صحة: "🏥",
  فواتير: "💡", رواتب: "💵", أخرى: "💳",
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

function formatDate(dateText: string | null): string {
  if (!dateText) return "-";
  const date = new Date(`${dateText}T12:00:00+03:00`);
  if (isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("ar-EG-u-nu-latn", {
    month: "short", day: "numeric",
    timeZone: "Asia/Riyadh", calendar: "gregory",
  });
}

/* تاريخ اليوم بتوقيت السعودية — نص نظيف "YYYY-MM-DD" بدون فاصلة */
function getNowSA(): { year: number; month: number } {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }); // "2026-04-09"
  const [y, m] = s.split("-").map(Number);
  return { year: y!, month: m! - 1 }; /* month بصيغة 0-indexed */
}

function lastNMonths(n: number) {
  const result: { year: number; month: number; label: string }[] = [];
  const { year, month } = getNowSA();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES[d.getMonth()]! });
  }
  return result;
}

export default function ReportsPage() {
  const [expenses, setExpenses]           = useState<Expense[]>([]);
  const [loading, setLoading]             = useState(true);
  const { year: initYear, month: initMonth } = getNowSA();
  const [selectedMonth, setSelectedMonth] = useState<number>(initMonth);
  const [selectedYear, setSelectedYear]   = useState<number>(initYear);

  /* التوسيع في المكان */
  const [expandedCat, setExpandedCat]     = useState<string | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  useEffect(() => { void fetchExpenses(); }, []);

  async function fetchExpenses() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const { data } = await supabase
      .from("expenses")
      .select("id,store,amount,date,category")
      .eq("user_id", user.id)
      .gte("date", sixMonthsAgo.toISOString().split("T")[0]!)
      .order("date", { ascending: false });

    setExpenses(data ?? []);
    setLoading(false);
  }

  const months = lastNMonths(6);

  const monthlyTotals = months.map(({ year, month }) => {
    const total = expenses
      .filter((e) => {
        if (!e.date) return false;
        const d = new Date(`${e.date}T12:00:00+03:00`);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, e) => sum + toNumber(e.amount), 0);
    return { year, month, label: MONTH_NAMES[month]!, total };
  });

  const maxMonthly = Math.max(...monthlyTotals.map((m) => m.total), 1);

  const selectedExpenses = expenses.filter((e) => {
    if (!e.date) return false;
    const d = new Date(`${e.date}T12:00:00+03:00`);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const selectedTotal = selectedExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);

  const categoryStats = selectedExpenses.reduce<Record<string, { total: number; count: number; items: Expense[] }>>((acc, e) => {
    const cat = e.category ?? "أخرى";
    if (!acc[cat]) acc[cat] = { total: 0, count: 0, items: [] };
    acc[cat]!.total += toNumber(e.amount);
    acc[cat]!.count += 1;
    acc[cat]!.items.push(e);
    return acc;
  }, {});
  const sortedCats = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total);

  const storeStats = selectedExpenses.reduce<Record<string, { total: number; count: number; items: Expense[] }>>((acc, e) => {
    const s = e.store ?? "غير محدد";
    if (!acc[s]) acc[s] = { total: 0, count: 0, items: [] };
    acc[s]!.total += toNumber(e.amount);
    acc[s]!.count += 1;
    acc[s]!.items.push(e);
    return acc;
  }, {});
  const topStores = Object.entries(storeStats).sort((a, b) => b[1].total - a[1].total).slice(0, 5);

  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear  = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevTotal = expenses
    .filter((e) => {
      if (!e.date) return false;
      const d = new Date(`${e.date}T12:00:00+03:00`);
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    })
    .reduce((sum, e) => sum + toNumber(e.amount), 0);

  const diff    = selectedTotal - prevTotal;
  const diffPct = prevTotal > 0 ? Math.abs((diff / prevTotal) * 100) : null;

  /* عند تغيير الشهر نغلق التوسيع */
  function selectMonth(year: number, month: number) {
    setSelectedMonth(month);
    setSelectedYear(year);
    setExpandedCat(null);
    setExpandedStore(null);
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#1D9E75] px-4 py-8 pb-28 font-sans">
        <div className="mx-auto w-full max-w-xl space-y-4">

          {/* Header */}
          <header>
            <h1 className="text-3xl font-extrabold text-white">📊 التقارير</h1>
          </header>

          {loading ? (
            <div className="flex justify-center py-20">
              <span className="size-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
            </div>
          ) : (
            <>
              {/* ── مخطط الأشهر ── */}
              <div className="rounded-3xl bg-white p-5 shadow-lg">
                <p className="mb-4 text-sm font-bold text-gray-500">الإنفاق خلال 6 أشهر</p>
                <div className="flex items-end justify-between gap-1.5 h-36">
                  {monthlyTotals.map(({ year, month, label, total }) => {
                    const heightPct = maxMonthly > 0 ? (total / maxMonthly) * 100 : 0;
                    const isSelected = month === selectedMonth && year === selectedYear;
                    return (
                      <button key={`${year}-${month}`} type="button"
                        onClick={() => selectMonth(year, month)}
                        className="flex flex-1 flex-col items-center gap-1 group">
                        <span className={`text-xs font-bold ${isSelected ? "text-[#1D9E75]" : "text-gray-300"}`}>
                          {total > 0 ? total.toFixed(0) : ""}
                        </span>
                        <div className="w-full flex items-end justify-center" style={{ height: "90px" }}>
                          <div className={`w-full rounded-t-xl transition-all ${isSelected ? "bg-[#1D9E75]" : "bg-[#1D9E75]/20 group-hover:bg-[#1D9E75]/40"}`}
                            style={{ height: `${Math.max(heightPct, total > 0 ? 5 : 0)}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${isSelected ? "text-[#1D9E75]" : "text-gray-400"}`}>
                          {label.slice(0, 3)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-xs text-gray-400">اضغط على أي شهر لعرض تفاصيله</p>
              </div>

              {/* ── ملخص الشهر ── */}
              <div className="rounded-3xl bg-white p-5 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">{MONTH_NAMES[selectedMonth]}</p>
                    <p className="text-4xl font-extrabold text-[#1D9E75]">
                      {selectedTotal.toFixed(2)}
                      <span className="mr-1 text-lg font-semibold text-gray-400">ر.س</span>
                    </p>
                  </div>
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

              {/* ── التصنيفات — قابلة للتوسيع ── */}
              {sortedCats.length > 0 && (
                <div className="rounded-3xl bg-white p-4 shadow-lg">
                  <p className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">الإجمالي حسب التصنيف</p>
                  <div className="divide-y divide-gray-50">
                  {sortedCats.map(([cat, { total, count, items }]) => {
                    const pct    = selectedTotal > 0 ? (total / selectedTotal) * 100 : 0;
                    const isOpen = expandedCat === cat;
                    return (
                      <div key={cat}>
                        {/* صف مضغوط */}
                        <button
                          type="button"
                          onClick={() => setExpandedCat(isOpen ? null : cat)}
                          className={`w-full flex items-center gap-2 px-2 py-2.5 transition-colors rounded-xl ${isOpen ? "bg-[#1D9E75]/6" : "hover:bg-gray-50"}`}
                        >
                          {/* أيقونة */}
                          <span className="text-base shrink-0">{CATEGORY_ICONS[cat] ?? "💳"}</span>
                          {/* اسم + شريط */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-700 truncate">{cat}</span>
                              <span className="text-sm font-extrabold text-[#1D9E75] shrink-0 mr-2">
                                {total.toFixed(0)}<span className="text-[10px] font-normal text-gray-400"> ر.س</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                                <div className="h-1.5 rounded-full bg-[#1D9E75]" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0">{pct.toFixed(0)}%</span>
                              <span className="text-[10px] text-gray-300 shrink-0">·</span>
                              <span className="text-[10px] text-gray-400 shrink-0">{count}×</span>
                            </div>
                          </div>
                          <span className={`text-[10px] text-gray-300 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                        </button>

                        {/* تفاصيل مضغوطة */}
                        {isOpen && (
                          <div className="mx-2 mb-1 rounded-xl bg-gray-50 divide-y divide-gray-100 overflow-hidden">
                            {items.map((e) => (
                              <div key={e.id} className="flex items-center justify-between px-3 py-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-700 truncate">{e.store ?? "غير محدد"}</p>
                                  <p className="text-[10px] text-gray-400">{formatDate(e.date)}</p>
                                </div>
                                <p className="text-xs font-extrabold text-[#1D9E75] shrink-0 mr-3">
                                  {toNumber(e.amount).toFixed(2)}<span className="text-[10px] font-normal text-gray-400"> ر.س</span>
                                </p>
                              </div>
                            ))}
                            <div className="flex justify-end px-3 py-1.5">
                              <Link href="/add" className="text-[10px] font-bold text-[#1D9E75]">+ أضف</Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}

              {/* ── أكثر المتاجر — قابلة للتوسيع ── */}
              {topStores.length > 0 && (
                <div className="rounded-3xl bg-white p-5 shadow-lg space-y-1">
                  <p className="mb-3 text-sm font-bold text-gray-500">أكثر المتاجر إنفاقاً</p>
                  {topStores.map(([store, { total, count, items }], i) => {
                    const isOpen = expandedStore === store;
                    return (
                      <div key={store} className="rounded-2xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedStore(isOpen ? null : store)}
                          className={`w-full flex items-center gap-3 px-3 py-3 transition-colors ${isOpen ? "bg-[#1D9E75]/8" : "hover:bg-gray-50"}`}
                        >
                          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                            i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-orange-300"
                          }`}>{i + 1}</span>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-bold text-gray-800 truncate">{store}</p>
                            <p className="text-xs text-gray-400">{count} {count === 1 ? "مرة" : "مرات"}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-sm font-extrabold text-[#1D9E75]">
                              {total.toFixed(2)} <span className="text-xs font-normal text-gray-400">ر.س</span>
                            </p>
                            <span className={`text-xs text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-[#1D9E75]/10 bg-[#1D9E75]/4 divide-y divide-gray-100">
                            {items.map((e) => (
                              <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-500">{e.category ?? "أخرى"}</p>
                                  <p className="text-xs text-gray-400">{formatDate(e.date)}</p>
                                </div>
                                <p className="text-sm font-extrabold text-[#1D9E75] shrink-0">
                                  {toNumber(e.amount).toFixed(2)}
                                  <span className="text-xs font-normal text-gray-400"> ر.س</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* فارغ */}
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
      <BottomNav />
    </AuthGuard>
  );
}
