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
  مطاعم: "🍽️",
  قهوة: "☕",
  بنزين: "⛽",
  سوبرماركت: "🛒",
  تسوق: "🛍️",
  أخرى: "💳",
};

function toNumber(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDate(dateText: string | null): string {
  if (!dateText) return "-";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  useEffect(() => {
    void fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("id,store,amount,date,category")
      .order("date", { ascending: false });
    if (fetchError) {
      setError("تعذر تحميل المصاريف.");
    } else {
      setExpenses(data ?? []);
    }
    setLoading(false);
  }

  async function handleDelete(id: number | string) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/delete?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert("فشل الحذف، حاول مجدداً");
      }
    } catch {
      alert("حدث خطأ، حاول مجدداً");
    } finally {
      setDeletingId(null);
    }
  }

  const now = new Date();
  const currentMonthTotal = expenses.reduce((sum, expense) => {
    if (!expense.date) return sum;
    const date = new Date(expense.date);
    if (Number.isNaN(date.getTime())) return sum;
    const isCurrentMonth =
      date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    return isCurrentMonth ? sum + toNumber(expense.amount) : sum;
  }, 0);

  return (
    <AuthGuard>
    <main className="min-h-screen bg-[#1D9E75] px-6 py-10 font-sans">
      <div className="mx-auto w-full max-w-xl space-y-5">

        {/* Header card */}
        <header className="rounded-3xl bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold text-[#1D9E75]">مصاريفي</h1>
            <Link
              href="/"
              className="rounded-xl bg-[#1D9E75]/10 px-4 py-2 text-sm font-semibold text-[#1D9E75] transition-opacity hover:opacity-70"
            >
              ← الرئيسية
            </Link>
          </div>

          <div className="mt-5 rounded-2xl bg-[#1D9E75]/5 p-4">
            <p className="text-xs font-medium text-gray-500">إجمالي الشهر الحالي</p>
            <p className="mt-1 text-4xl font-extrabold text-[#1D9E75]">
              {currentMonthTotal.toFixed(2)}
              <span className="mr-1 text-lg font-semibold text-gray-400">ر.س</span>
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </header>

        {/* Add button */}
        <Link
          href="/add"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-lg font-bold text-[#1D9E75] shadow transition-opacity hover:opacity-90"
        >
          <span className="text-xl">+</span> أضف مصروف
        </Link>

        {/* Expenses list */}
        <section className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <span className="size-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow">
              <p className="text-4xl">🧾</p>
              <p className="mt-3 font-semibold text-gray-600">لا توجد مصاريف حتى الآن</p>
              <p className="mt-1 text-sm text-gray-400">ارفع أول فاتورة وابدأ التتبع</p>
            </div>
          ) : (
            expenses.map((expense) => (
              <article
                key={expense.id}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow"
              >
                {/* Category icon */}
                <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#1D9E75]/10 text-2xl">
                  {CATEGORY_ICONS[expense.category ?? "أخرى"] ?? "💳"}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-800">
                    {expense.store ?? "غير محدد"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {expense.category ?? "-"} · {formatDate(expense.date)}
                  </p>
                </div>

                {/* Amount + delete */}
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <p className="text-lg font-extrabold text-[#1D9E75]">
                    {toNumber(expense.amount).toFixed(2)}
                    <span className="mr-0.5 text-xs font-normal text-gray-400">ر.س</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDelete(expense.id)}
                    disabled={deletingId === expense.id}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    {deletingId === expense.id ? "..." : "حذف"}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
    </AuthGuard>
  );
}
