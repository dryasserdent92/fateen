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
  item_name: string | null;
  item_brand: string | null;
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

  /* وضع التحديد المتعدد */
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setExpenses([]);
      setError("تعذر التحقق من المستخدم الحالي.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("id,store,amount,date,category,item_name,item_brand")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    if (fetchError) {
      setError("تعذر تحميل المصاريف.");
    } else {
      setExpenses(data ?? []);
    }
    setLoading(false);
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelected(new Set());
  }

  function toggleItem(id: number | string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === expenses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(expenses.map((e) => e.id)));
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`هل تريد حذف ${selected.size} مصروف؟`)) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/delete?id=${id}`, { method: "DELETE" }),
        ),
      );
      setExpenses((prev) => prev.filter((e) => !selected.has(e.id)));
      setSelected(new Set());
      setSelectMode(false);
    } catch {
      alert("حدث خطأ أثناء الحذف، حاول مجدداً");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteSingle(id: number | string) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    try {
      const res = await fetch(`/api/delete?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert("فشل الحذف، حاول مجدداً");
      }
    } catch {
      alert("حدث خطأ، حاول مجدداً");
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

  /* ملخص التصنيفات */
  const categoryTotals = expenses.reduce<Record<string, number>>((acc, expense) => {
    const cat = expense.category ?? "أخرى";
    acc[cat] = (acc[cat] ?? 0) + toNumber(expense.amount);
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  const allSelected = expenses.length > 0 && selected.size === expenses.length;

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

            {/* ملخص التصنيفات */}
            {sortedCategories.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 px-1">الإجمالي حسب التصنيف</p>
                <div className="grid grid-cols-2 gap-2">
                  {sortedCategories.map(([cat, total]) => {
                    const pct = currentMonthTotal > 0 ? (total / currentMonthTotal) * 100 : 0;
                    return (
                      <div key={cat} className="rounded-2xl bg-[#1D9E75]/5 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{CATEGORY_ICONS[cat] ?? "💳"}</span>
                          <span className="text-xs font-semibold text-gray-600 truncate">{cat}</span>
                        </div>
                        <p className="text-lg font-extrabold text-[#1D9E75]">
                          {total.toFixed(2)}
                          <span className="mr-0.5 text-xs font-normal text-gray-400">ر.س</span>
                        </p>
                        {/* شريط النسبة */}
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#1D9E75]/15">
                          <div
                            className="h-1.5 rounded-full bg-[#1D9E75]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">{pct.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
          </header>

          {/* Action bar */}
          <div className="flex gap-3">
            {!selectMode ? (
              <>
                <Link
                  href="/add"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-4 text-lg font-bold text-[#1D9E75] shadow transition-opacity hover:opacity-90"
                >
                  <span className="text-xl">+</span> أضف مصروف
                </Link>
                {expenses.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectMode}
                    className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-gray-500 shadow transition-opacity hover:opacity-80"
                  >
                    تحديد
                  </button>
                )}
              </>
            ) : (
              /* شريط وضع التحديد */
              <div className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 shadow">
                {/* تحديد الكل */}
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-sm font-semibold text-[#1D9E75]"
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-md border-2 transition-colors ${
                      allSelected
                        ? "border-[#1D9E75] bg-[#1D9E75] text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {allSelected && "✓"}
                  </span>
                  الكل
                </button>

                <p className="flex-1 text-center text-sm text-gray-500">
                  {selected.size > 0 ? `${selected.size} محدد` : "اختر مصاريف"}
                </p>

                {/* زر حذف المحدد */}
                <button
                  type="button"
                  onClick={() => void handleDeleteSelected()}
                  disabled={selected.size === 0 || deleting}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {deleting ? "..." : `حذف (${selected.size})`}
                </button>

                {/* إلغاء */}
                <button
                  type="button"
                  onClick={toggleSelectMode}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 transition-opacity hover:opacity-80"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>

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
              expenses.map((expense) => {
                const isSelected = selected.has(expense.id);
                return (
                  <article
                    key={expense.id}
                    onClick={() => selectMode && toggleItem(expense.id)}
                    className={`flex items-center gap-4 rounded-2xl bg-white p-4 shadow transition-all ${
                      selectMode ? "cursor-pointer" : ""
                    } ${isSelected ? "ring-2 ring-[#1D9E75]" : ""}`}
                  >
                    {/* Checkbox في وضع التحديد */}
                    {selectMode && (
                      <div
                        className={`flex size-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                          isSelected
                            ? "border-[#1D9E75] bg-[#1D9E75] text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <span className="text-xs font-bold">✓</span>}
                      </div>
                    )}

                    {/* Category icon */}
                    {!selectMode && (
                      <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#1D9E75]/10 text-2xl">
                        {CATEGORY_ICONS[expense.category ?? "أخرى"] ?? "💳"}
                      </div>
                    )}

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-gray-800">
                        {expense.store ?? "غير محدد"}
                      </p>
                      {(expense.item_name || expense.item_brand) && (
                        <p className="truncate text-xs font-medium text-[#1D9E75]">
                          {[expense.item_brand, expense.item_name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-400">
                        {expense.category ?? "-"} · {formatDate(expense.date)}
                      </p>
                    </div>

                    {/* Amount + single delete */}
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <p className="text-lg font-extrabold text-[#1D9E75]">
                        {toNumber(expense.amount).toFixed(2)}
                        <span className="mr-0.5 text-xs font-normal text-gray-400">ر.س</span>
                      </p>
                      {!selectMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteSingle(expense.id);
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </main>
    </AuthGuard>
  );
}
