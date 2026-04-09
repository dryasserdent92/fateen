"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import AuthGuard from "../components/auth-guard";

type ExpenseItem = {
  name: string;
  brand: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Expense = {
  id: number | string;
  store: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  item_name: string | null;
  item_brand: string | null;
  items: ExpenseItem[] | null;
};

const CATEGORY_ICONS: Record<string, string> = {
  مطاعم: "🍽️",
  قهوة: "☕",
  بنزين: "⛽",
  سوبرماركت: "🛒",
  تسوق: "🛍️",
  صحة: "🏥",
  فواتير: "💡",
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
  /* نضيف T12:00:00 لتجنب مشكلة اختلاف التوقيت عند تحويل التاريخ */
  const date = new Date(`${dateText}T12:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Riyadh",
    calendar: "gregory",
  });
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* فلتر التصنيف */
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  /* التوسيع في المكان */
  const [expandedId, setExpandedId] = useState<number | string | null>(null);

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
      .select("id,store,amount,date,category,item_name,item_brand,items")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    if (fetchError) {
      setError("تعذر تحميل المصاريف.");
    } else {
      setExpenses(data ?? []);
    }
    setLoading(false);
  }

  /* المصاريف المعروضة بعد الفلتر */
  const visibleExpenses = filterCategory
    ? expenses.filter((e) => (e.category ?? "أخرى") === filterCategory)
    : expenses;

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
    if (selected.size === visibleExpenses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleExpenses.map((e) => e.id)));
    }
  }

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { "Authorization": `Bearer ${session.access_token}` }
      : {};
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`هل تريد حذف ${selected.size} مصروف؟`)) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeader();
      await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/delete?id=${id}`, { method: "DELETE", headers }),
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
      const headers = await getAuthHeader();
      const res = await fetch(`/api/delete?id=${id}`, { method: "DELETE", headers });
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert("فشل الحذف، حاول مجدداً");
      }
    } catch {
      alert("حدث خطأ، حاول مجدداً");
    }
  }

  /* تاريخ اليوم بتوقيت السعودية */
  const nowSA = new Date(new Date().toLocaleString("en-CA", { timeZone: "Asia/Riyadh", hour12: false }));
  const currentMonthTotal = expenses.reduce((sum, expense) => {
    if (!expense.date) return sum;
    const date = new Date(`${expense.date}T12:00:00+03:00`);
    if (Number.isNaN(date.getTime())) return sum;
    const isCurrentMonth =
      date.getFullYear() === nowSA.getFullYear() && date.getMonth() === nowSA.getMonth();
    return isCurrentMonth ? sum + toNumber(expense.amount) : sum;
  }, 0);

  /* ملخص التصنيفات */
  const categoryStats = expenses.reduce<Record<string, { total: number; count: number }>>((acc, expense) => {
    const cat = expense.category ?? "أخرى";
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat]!.total += toNumber(expense.amount);
    acc[cat]!.count += 1;
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total);

  const allSelected = visibleExpenses.length > 0 && selected.size === visibleExpenses.length;

  /* ── تقسيم المصاريف لمجموعات زمنية ── */
  function getWeekGroup(dateStr: string | null): "هذا الأسبوع" | "الأسبوع الماضي" | "أقدم" {
    if (!dateStr) return "أقدم";
    const d    = new Date(`${dateStr}T12:00:00+03:00`);
    const now  = new Date(new Date().toLocaleString("en-CA", { timeZone: "Asia/Riyadh", hour12: false }));
    const day  = now.getDay(); // 0=أحد
    // بداية هذا الأسبوع (الأحد)
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - day);
    startOfThisWeek.setHours(0, 0, 0, 0);
    // بداية الأسبوع الماضي
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    if (d >= startOfThisWeek)  return "هذا الأسبوع";
    if (d >= startOfLastWeek)  return "الأسبوع الماضي";
    return "أقدم";
  }

  type GroupKey = "هذا الأسبوع" | "الأسبوع الماضي" | "أقدم";
  const GROUP_ORDER: GroupKey[] = ["هذا الأسبوع", "الأسبوع الماضي", "أقدم"];
  const GROUP_ICONS: Record<GroupKey, string> = {
    "هذا الأسبوع":    "🗓",
    "الأسبوع الماضي": "📅",
    "أقدم":           "🗃",
  };

  const groupedExpenses = visibleExpenses.reduce<Record<GroupKey, Expense[]>>((acc, e) => {
    const g = getWeekGroup(e.date);
    if (!acc[g]) acc[g] = [];
    acc[g]!.push(e);
    return acc;
  }, {} as Record<GroupKey, Expense[]>);

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#1D9E75] px-6 py-10 font-sans">
        <div className="mx-auto w-full max-w-xl space-y-5">

          {/* Header card */}
          <header className="rounded-3xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-extrabold text-[#1D9E75]">مصاريفي</h1>
              <div className="flex gap-2">
                <Link
                  href="/reports"
                  className="rounded-xl bg-[#1D9E75]/10 px-3 py-2 text-sm font-semibold text-[#1D9E75] transition-opacity hover:opacity-70"
                >
                  📊 تقارير
                </Link>
                <Link
                  href="/"
                  className="rounded-xl bg-[#1D9E75]/10 px-3 py-2 text-sm font-semibold text-[#1D9E75] transition-opacity hover:opacity-70"
                >
                  ← الرئيسية
                </Link>
              </div>
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
                  {sortedCategories.map(([cat, { total, count }]) => {
                    const pct = currentMonthTotal > 0 ? (total / currentMonthTotal) * 100 : 0;
                    const isActive = filterCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setFilterCategory(isActive ? null : cat);
                          setSelectMode(false);
                          setSelected(new Set());
                        }}
                        className={`rounded-2xl px-3 py-2.5 text-right transition-all ${
                          isActive
                            ? "bg-[#1D9E75] ring-2 ring-[#1D9E75]"
                            : "bg-[#1D9E75]/5 hover:bg-[#1D9E75]/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{CATEGORY_ICONS[cat] ?? "💳"}</span>
                            <span className={`text-xs font-semibold truncate ${isActive ? "text-white" : "text-gray-600"}`}>{cat}</span>
                          </div>
                          <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"}`}>
                            {count}×
                          </span>
                        </div>
                        <p className={`text-lg font-extrabold ${isActive ? "text-white" : "text-[#1D9E75]"}`}>
                          {total.toFixed(2)}
                          <span className={`mr-0.5 text-xs font-normal ${isActive ? "text-white/70" : "text-gray-400"}`}>ر.س</span>
                        </p>
                        <div className={`mt-1.5 h-1.5 w-full rounded-full ${isActive ? "bg-white/20" : "bg-[#1D9E75]/15"}`}>
                          <div
                            className={`h-1.5 rounded-full ${isActive ? "bg-white" : "bg-[#1D9E75]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className={`mt-0.5 text-xs ${isActive ? "text-white/70" : "text-gray-400"}`}>{pct.toFixed(0)}%</p>
                      </button>
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

          {/* شريط الفلتر النشط */}
          {filterCategory && (
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow">
              <div className="flex items-center gap-2">
                <span className="text-xl">{CATEGORY_ICONS[filterCategory] ?? "💳"}</span>
                <div>
                  <p className="text-sm font-bold text-gray-800">{filterCategory}</p>
                  <p className="text-xs text-gray-400">{visibleExpenses.length} مصروف</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setFilterCategory(null); setSelectMode(false); setSelected(new Set()); }}
                className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-200"
              >
                ✕ إلغاء الفلتر
              </button>
            </div>
          )}

          {/* Expenses list */}
          <section className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <span className="size-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              </div>
            ) : visibleExpenses.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow">
                <p className="text-4xl">🧾</p>
                <p className="mt-3 font-semibold text-gray-600">
                  {filterCategory ? `لا توجد مصاريف في ${filterCategory}` : "لا توجد مصاريف حتى الآن"}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {filterCategory ? "" : "ارفع أول فاتورة وابدأ التتبع"}
                </p>
              </div>
            ) : (
              GROUP_ORDER.filter((g) => (groupedExpenses[g] ?? []).length > 0).map((group) => (
                <div key={group} className="space-y-3">
                  {/* رأس المجموعة */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-base">{GROUP_ICONS[group]}</span>
                    <span className="text-sm font-bold text-white">{group}</span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                      {(groupedExpenses[group] ?? []).length}
                    </span>
                  </div>

                  {/* بطاقات المجموعة */}
                  {(groupedExpenses[group] ?? []).map((expense) => {
                    const isSelected = selected.has(expense.id);
                    const isExpanded = expandedId === expense.id;
                    const hasItems   = Array.isArray(expense.items) && expense.items.length > 0;
                    const hasDetail  = hasItems || expense.item_name || expense.item_brand;

                    return (
                      <article
                        key={expense.id}
                        className={`rounded-2xl bg-white shadow transition-all overflow-hidden ${
                          isSelected ? "ring-2 ring-[#1D9E75]" : ""
                        } ${isExpanded ? "ring-1 ring-[#1D9E75]/30" : ""}`}
                      >
                        {/* الصف الرئيسي */}
                        <div
                          onClick={() => {
                            if (selectMode) { toggleItem(expense.id); return; }
                            setExpandedId(isExpanded ? null : expense.id);
                          }}
                          className="flex cursor-pointer items-center gap-4 p-4"
                        >
                          {/* Checkbox */}
                          {selectMode && (
                            <div className={`flex size-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                              isSelected ? "border-[#1D9E75] bg-[#1D9E75] text-white" : "border-gray-300"
                            }`}>
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
                            {!isExpanded && (expense.item_name || expense.item_brand) && (
                              <p className="truncate text-xs font-medium text-[#1D9E75]">
                                {[expense.item_brand, expense.item_name].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-gray-400">
                              {expense.category ?? "-"} · {formatDate(expense.date)}
                            </p>
                          </div>

                          {/* Amount + expand indicator */}
                          <div className="flex flex-shrink-0 flex-col items-end gap-1">
                            <p className="text-lg font-extrabold text-[#1D9E75]">
                              {toNumber(expense.amount).toFixed(2)}
                              <span className="mr-0.5 text-xs font-normal text-gray-400">ر.س</span>
                            </p>
                            {!selectMode && (
                              <span className={`text-xs text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                {hasDetail ? "▼" : "·"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* التفاصيل الموسّعة */}
                        {isExpanded && !selectMode && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">

                            {/* السلعة والماركة */}
                            {(expense.item_name || expense.item_brand) && !hasItems && (
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🏷️</span>
                                <div>
                                  {expense.item_brand && <p className="text-xs font-bold text-gray-700">{expense.item_brand}</p>}
                                  {expense.item_name  && <p className="text-xs text-gray-500">{expense.item_name}</p>}
                                </div>
                              </div>
                            )}

                            {/* الأصناف المتعددة */}
                            {hasItems && (
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-gray-400">🛒 الأصناف</p>
                                {expense.items!.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                                      {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
                                      <p className="text-xs text-gray-400">{item.quantity} × {item.unit_price.toFixed(2)} ر.س</p>
                                    </div>
                                    <p className="text-sm font-bold text-[#1D9E75] shrink-0 mr-2">
                                      {item.total_price.toFixed(2)} ر.س
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* التاريخ الكامل */}
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>📅</span>
                              <span>{formatDate(expense.date)}</span>
                            </div>

                            {/* زر الحذف */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteSingle(expense.id);
                              }}
                              className="w-full rounded-xl border border-red-200 py-2 text-sm font-bold text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              🗑 حذف هذا المصروف
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ))
            )}
          </section>
        </div>
      </main>
    </AuthGuard>
  );
}
