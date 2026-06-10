"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { apiUrl } from "../../lib/api-client";
import AuthGuard from "../components/auth-guard";
import BottomNav from "../components/bottom-nav";
import { loadSettings, getPeriodStart, type UserSettings } from "../../lib/user-settings";

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
  سيارة: "🚗",
  سوبرماركت: "🛒",
  تسوق: "🛍️",
  صحة: "🏥",
  فواتير: "💡",
  رواتب: "💵",
  أخرى: "💳",
};

const CATEGORY_COLORS: Record<string, string> = {
  مطاعم:    "#F97316",
  قهوة:     "#A16207",
  بنزين:    "#EAB308",
  سيارة:    "#2563EB",
  سوبرماركت:"#16A34A",
  تسوق:     "#DB2777",
  صحة:      "#0891B2",
  فواتير:   "#7C3AED",
  رواتب:    "#475569",
  أخرى:     "#94A3B8",
};

const FALLBACK_COLORS = ["#1D9E75","#F97316","#3B82F6","#EC4899","#EAB308","#8B5CF6","#14B8A6","#64748B","#22C55E","#F43F5E"];

function catColor(cat: string, idx: number): string {
  return CATEGORY_COLORS[cat] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]!;
}

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

  /* البحث */
  const [searchQuery, setSearchQuery] = useState("");

  /* عرض الرسوم أو القائمة */
  const [viewMode, setViewMode] = useState<"list" | "charts">("list");

  /* التوسيع في المكان */
  const [expandedId, setExpandedId] = useState<number | string | null>(null);

  /* وضع التحديد المتعدد */
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({ startDay: 1, budget: 0, customCategories: [] });

  /* فلتر الشهر — يبدأ بالشهر الحالي */
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }).slice(0, 7)
  );

  /* التعديل */
  type EditItem = { name: string; brand: string; quantity: number; unit_price: number; total_price: number };
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editStore, setEditStore]       = useState("");
  const [editAmount, setEditAmount]     = useState("");
  const [editDate, setEditDate]         = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editItems, setEditItems]       = useState<EditItem[]>([]);
  const [saving, setSaving]             = useState(false);

  /* ── وضع الترتيب ── */
  const [reorderMode, setReorderMode] = useState(false);
  const [dayOrders, setDayOrders] = useState<Record<string, string[]>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const pointerDragRef = useRef<{ id: string; dateKey: string } | null>(null);

  useEffect(() => {
    setUserSettings(loadSettings());
    void fetchExpenses();
    try {
      const raw = localStorage.getItem("fateen_expense_order");
      if (raw) setDayOrders(JSON.parse(raw) as Record<string, string[]>);
    } catch {}
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
          fetch(apiUrl(`/api/delete?id=${id}`), { method: "DELETE", headers }),
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
      const res = await fetch(apiUrl(`/api/delete?id=${id}`), { method: "DELETE", headers });
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert("فشل الحذف، حاول مجدداً");
      }
    } catch {
      alert("حدث خطأ، حاول مجدداً");
    }
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setEditStore(expense.store ?? "");
    setEditAmount(expense.amount != null ? String(expense.amount) : "");
    setEditDate(expense.date ?? "");
    setEditCategory(expense.category ?? "أخرى");
    setEditItems(
      Array.isArray(expense.items) && expense.items.length > 0
        ? expense.items.map(i => ({ name: i.name, brand: i.brand ?? "", quantity: i.quantity, unit_price: i.unit_price, total_price: i.total_price }))
        : []
    );
    setExpandedId(null);
  }

  function addItem() {
    setEditItems(prev => [...prev, { name: "", brand: "", quantity: 1, unit_price: 0, total_price: 0 }]);
  }

  function removeItem(idx: number) {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof EditItem, value: string | number) {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // إعادة حساب السعر الإجمالي تلقائياً
      if (field === "quantity" || field === "unit_price") {
        updated.total_price = parseFloat(String(updated.quantity)) * parseFloat(String(updated.unit_price)) || 0;
        updated.total_price = Math.round(updated.total_price * 100) / 100;
      }
      return updated;
    }));
  }

  // إعادة حساب المبلغ الإجمالي من الأصناف تلقائياً
  function recalcTotalFromItems(items: EditItem[]) {
    if (items.length === 0) return;
    const total = items.reduce((s, i) => s + (i.total_price || 0), 0);
    setEditAmount(String(Math.round(total * 100) / 100));
  }

  async function handleSaveEdit() {
    if (!editingExpense) return;
    setSaving(true);
    try {
      const headers = { ...(await getAuthHeader()), "Content-Type": "application/json" };
      const cleanItems = editItems.filter(i => i.name.trim()).map(i => ({
        name: i.name.trim(),
        brand: i.brand.trim() || null,
        quantity: parseFloat(String(i.quantity)) || 1,
        unit_price: parseFloat(String(i.unit_price)) || 0,
        total_price: parseFloat(String(i.total_price)) || 0,
      }));
      const res = await fetch(apiUrl("/api/update"), {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id:         editingExpense.id,
          store:      editStore.trim() || null,
          amount:     parseFloat(editAmount) || 0,
          date:       editDate || null,
          category:   editCategory,
          items:      cleanItems.length > 0 ? cleanItems : null,
          item_name:  cleanItems.length === 0 ? (editingExpense.item_name ?? null) : null,
          item_brand: cleanItems.length === 0 ? (editingExpense.item_brand ?? null) : null,
        }),
      });
      if (res.ok) {
        setExpenses((prev) => prev.map((e) =>
          e.id === editingExpense.id
            ? { ...e, store: editStore.trim() || null, amount: parseFloat(editAmount) || 0, date: editDate || null, category: editCategory, items: cleanItems.length > 0 ? cleanItems : null }
            : e
        ));
        setEditingExpense(null);
      } else {
        alert("فشل الحفظ، حاول مجدداً");
      }
    } catch {
      alert("حدث خطأ، حاول مجدداً");
    } finally {
      setSaving(false);
    }
  }

  /* تاريخ اليوم بتوقيت السعودية */
  const todaySAStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  const currentMonthKey = todaySAStr.slice(0, 7);

  const MONTH_NAMES = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  function getMonthKey(dateStr: string | null): string {
    if (!dateStr) return "غير محدد";
    return dateStr.slice(0, 7);
  }

  function monthKeyLabel(key: string): string {
    if (key === "غير محدد") return "غير محدد";
    const [y, m] = key.split("-");
    const monthIdx = parseInt(m ?? "1") - 1;
    return `${MONTH_NAMES[monthIdx] ?? m} ${y}`;
  }

  /* كل الأشهر المتوفرة في البيانات — مرتبة من الأحدث */
  const allMonthKeys: string[] = [
    ...new Set(expenses.map(e => getMonthKey(e.date)).filter(k => k !== "غير محدد"))
  ];
  if (!allMonthKeys.includes(currentMonthKey)) allMonthKeys.push(currentMonthKey);
  allMonthKeys.sort((a, b) => b.localeCompare(a));

  const selectedIdx = allMonthKeys.indexOf(selectedMonthKey) >= 0
    ? allMonthKeys.indexOf(selectedMonthKey)
    : 0;

  /* مصاريف الشهر المختار */
  const selectedMonthExpenses = expenses.filter(e => getMonthKey(e.date) === selectedMonthKey);

  /* البحث — يعمل على كل المصاريف بغض النظر عن الشهر */
  const searchActive = searchQuery.trim().length > 0;
  const searchResults = searchActive
    ? expenses.filter(e => {
        const q = searchQuery.trim().toLowerCase();
        if ((e.store ?? "").toLowerCase().includes(q)) return true;
        if ((e.category ?? "").toLowerCase().includes(q)) return true;
        if ((e.item_name ?? "").toLowerCase().includes(q)) return true;
        if (Array.isArray(e.items) && e.items.some(i => i.name?.toLowerCase().includes(q))) return true;
        return false;
      })
    : null;

  /* المصاريف المعروضة — بحث أو شهر + فلتر التصنيف */
  const baseExpenses = searchResults ?? selectedMonthExpenses;
  const visibleExpenses = filterCategory
    ? baseExpenses.filter((e) => (e.category ?? "أخرى") === filterCategory)
    : baseExpenses;

  /* إجمالي الشهر المختار */
  const currentMonthTotal = selectedMonthExpenses.reduce((s, e) => s + toNumber(e.amount), 0);

  /* ملخص التصنيفات للشهر المختار */
  const categoryStats = selectedMonthExpenses.reduce<Record<string, { total: number; count: number }>>((acc, expense) => {
    const cat = expense.category ?? "أخرى";
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat]!.total += toNumber(expense.amount);
    acc[cat]!.count += 1;
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total);

  /* دمج التصنيفات الافتراضية مع التصنيفات المخصصة */
  const allCategoryIcons: Record<string, string> = { ...CATEGORY_ICONS };
  (userSettings.customCategories ?? []).forEach(c => { allCategoryIcons[c.name] = c.icon; });


  /* الميزانية — تظهر فقط للشهر الحالي */
  const periodStart = getPeriodStart(todaySAStr, userSettings.startDay);
  const periodTotal = selectedMonthKey === currentMonthKey
    ? expenses.reduce((s, e) => (!e.date ? s : e.date >= periodStart ? s + toNumber(e.amount) : s), 0)
    : null;
  const remaining = userSettings.budget > 0 && periodTotal !== null
    ? userSettings.budget - periodTotal
    : null;

  const allSelected = visibleExpenses.length > 0 && selected.size === visibleExpenses.length;

  /* ── منطق الترتيب ── */
  function getOrderedDayExpenses(dayExp: Expense[], dateKey: string): Expense[] {
    const order = dayOrders[dateKey];
    if (!order || order.length === 0) return dayExp;
    const result: Expense[] = [];
    order.forEach(id => { const f = dayExp.find(e => String(e.id) === id); if (f) result.push(f); });
    dayExp.forEach(e => { if (!result.find(r => r.id === e.id)) result.push(e); });
    return result;
  }

  function moveItemAndUpdate(dateKey: string, fromId: string, toId: string) {
    if (fromId === toId) return;
    const dayExp = visibleExpenses.filter(e => (e.date ?? "غير محدد") === dateKey);
    const ordered = getOrderedDayExpenses(dayExp, dateKey);
    const from = ordered.findIndex(e => String(e.id) === fromId);
    const to   = ordered.findIndex(e => String(e.id) === toId);
    if (from === -1 || to === -1) return;
    const arr = [...ordered];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item!);
    const newOrders = { ...dayOrders, [dateKey]: arr.map(e => String(e.id)) };
    setDayOrders(newOrders);
    try { localStorage.setItem("fateen_expense_order", JSON.stringify(newOrders)); } catch {}
  }

  /* تجميع المصاريف المرئية حسب اليوم */
  const dayGroups = visibleExpenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const day = e.date ?? "غير محدد";
    if (!acc[day]) acc[day] = [];
    acc[day]!.push(e);
    return acc;
  }, {});
  const sortedDays = Object.keys(dayGroups).sort((a, b) => b.localeCompare(a));

  /* تقييم حي في نافذة التعديل */
  function computeEditScore(): number {
    const validItems = editItems.filter(i => i.name.trim());
    if (validItems.length > 0) {
      return validItems.every(i => i.unit_price > 0 && i.quantity > 0) ? 10 : 7;
    }
    if (editingExpense?.item_name?.trim()) return 5;
    if (editStore.trim()) return 3;
    return 1;
  }

  /* ── نظام تقييم جودة البيانات ── */
  function scoreExpense(e: Expense): number {
    const hasItems = Array.isArray(e.items) && e.items.length > 0;
    if (hasItems) {
      const fullyDetailed = e.items!.every(i => i.name?.trim() && i.unit_price > 0 && i.quantity > 0);
      return fullyDetailed ? 10 : 7;
    }
    if (e.item_name?.trim()) return 5;
    if (e.store?.trim())     return 3;
    return 1;
  }

  function scoreLabel(score: number): { text: string; emoji: string; color: string; bar: string } {
    if (score >= 9)  return { text: "ممتاز",   emoji: "🌟", color: "text-emerald-600", bar: "bg-emerald-500" };
    if (score >= 7)  return { text: "جيد جداً", emoji: "👍", color: "text-green-600",   bar: "bg-green-400"   };
    if (score >= 5)  return { text: "جيد",      emoji: "🙂", color: "text-yellow-600",  bar: "bg-yellow-400"  };
    if (score >= 3)  return { text: "متوسط",    emoji: "😐", color: "text-orange-500",  bar: "bg-orange-400"  };
    return               { text: "ضعيف",     emoji: "📉", color: "text-red-500",     bar: "bg-red-400"     };
  }

  const monthScoreRaw = selectedMonthExpenses.length > 0
    ? selectedMonthExpenses.reduce((s, e) => s + scoreExpense(e), 0) / selectedMonthExpenses.length
    : null;
  const monthScore = monthScoreRaw !== null ? Math.round(monthScoreRaw * 10) / 10 : null;
  const monthScoreLabel = monthScore !== null ? scoreLabel(monthScore) : null;

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#1D9E75] px-6 py-10 pb-28 font-sans">
        <div className="mx-auto w-full max-w-xl space-y-5">

          {/* Header card */}
          <header className="rounded-3xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-extrabold text-[#1D9E75]">مصاريفي</h1>
            </div>

            {/* صندوق البحث */}
            <div className="mt-4 relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-lg pointer-events-none">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setFilterCategory(null); }}
                placeholder="ابحث عن محل، صنف، أو تصنيف..."
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pr-9 pl-10 text-sm text-gray-700 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]/30 placeholder-gray-300"
                dir="rtl"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors text-xs"
                >✕</button>
              )}
            </div>

            {/* تنقل بين الأشهر — مخفي لما البحث نشط */}
            {!loading && allMonthKeys.length > 0 && !searchActive && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#1D9E75]/5 px-2 py-2">
                {/* الشهر السابق (أقدم) */}
                <button
                  type="button"
                  disabled={selectedIdx >= allMonthKeys.length - 1}
                  onClick={() => {
                    setSelectedMonthKey(allMonthKeys[selectedIdx + 1]!);
                    setFilterCategory(null);
                  }}
                  className="flex size-9 items-center justify-center rounded-xl text-[#1D9E75] font-bold disabled:opacity-25 hover:bg-[#1D9E75]/10 active:scale-95 transition-all"
                >◀</button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-extrabold text-[#1D9E75]">
                    {monthKeyLabel(selectedMonthKey)}
                  </p>
                  {selectedMonthKey === currentMonthKey && (
                    <p className="text-xs text-[#1D9E75]/50">الشهر الحالي</p>
                  )}
                </div>
                {/* الشهر التالي (أحدث) */}
                <button
                  type="button"
                  disabled={selectedIdx <= 0}
                  onClick={() => {
                    setSelectedMonthKey(allMonthKeys[selectedIdx - 1]!);
                    setFilterCategory(null);
                  }}
                  className="flex size-9 items-center justify-center rounded-xl text-[#1D9E75] font-bold disabled:opacity-25 hover:bg-[#1D9E75]/10 active:scale-95 transition-all"
                >▶</button>
              </div>
            )}

            <div className="mt-3 rounded-2xl bg-[#1D9E75]/5 p-4 space-y-3">
              <div>
                {searchActive ? (
                  <>
                    <p className="text-xs font-medium text-gray-500">نتائج البحث عن "{searchQuery.trim()}"</p>
                    <p className="mt-1 text-2xl font-extrabold text-[#1D9E75]">
                      {visibleExpenses.length} نتيجة
                      <span className="mr-2 text-base font-semibold text-gray-400">
                        · {visibleExpenses.reduce((s, e) => s + toNumber(e.amount), 0).toFixed(2)} ر.س
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-gray-500">
                      {selectedMonthKey === currentMonthKey ? "إجمالي الفترة الحالية" : `إجمالي ${monthKeyLabel(selectedMonthKey)}`}
                      {selectedMonthKey === currentMonthKey && userSettings.startDay !== 1 && (
                        <span className="mr-1 text-gray-400">(منذ {userSettings.startDay} الشهر)</span>
                      )}
                    </p>
                    <p className="mt-1 text-4xl font-extrabold text-[#1D9E75]">
                      {currentMonthTotal.toFixed(2)}
                      <span className="mr-1 text-lg font-semibold text-gray-400">ر.س</span>
                    </p>
                  </>
                )}
              </div>

              {/* شريط الميزانية */}
              {remaining !== null && !searchActive && (
                <div className="border-t border-[#1D9E75]/10 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">الميزانية: {userSettings.budget.toLocaleString()} ر.س</span>
                    <span className={`font-bold ${remaining >= 0 ? "text-[#1D9E75]" : "text-red-500"}`}>
                      {remaining >= 0 ? `متبقي ${remaining.toFixed(0)}` : `تجاوزت ${Math.abs(remaining).toFixed(0)}`} ر.س
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1D9E75]/15 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        currentMonthTotal / userSettings.budget > 0.9 ? "bg-red-400" :
                        currentMonthTotal / userSettings.budget > 0.7 ? "bg-amber-400" : "bg-[#1D9E75]"
                      }`}
                      style={{ width: `${Math.min((currentMonthTotal / userSettings.budget) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-left">
                    {Math.min((currentMonthTotal / userSettings.budget) * 100, 100).toFixed(0)}% من الميزانية
                  </p>
                </div>
              )}
            </div>

            {/* ── تقييم جودة البيانات الشهري ── */}
            {!loading && monthScore !== null && monthScoreLabel && !searchActive && (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{monthScoreLabel.emoji}</span>
                    <div>
                      <p className="text-xs font-bold text-gray-600">جودة تفاصيل المصاريف</p>
                      <p className={`text-xs font-semibold ${monthScoreLabel.color}`}>{monthScoreLabel.text}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-extrabold ${monthScoreLabel.color}`}>{monthScore.toFixed(1)}</span>
                    <span className="text-xs text-gray-400 font-semibold">/10</span>
                  </div>
                </div>
                {/* شريط التقييم */}
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${monthScoreLabel.bar}`}
                    style={{ width: `${(monthScore / 10) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  {selectedMonthExpenses.filter(e => Array.isArray(e.items) && e.items.length > 0).length} من {selectedMonthExpenses.length} فاتورة بتفاصيل كاملة
                </p>
              </div>
            )}

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
                            <span className="text-base">{allCategoryIcons[cat] ?? "💳"}</span>
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
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode(v => v === "charts" ? "list" : "charts");
                        setReorderMode(false);
                        setSelectMode(false);
                      }}
                      className={`rounded-2xl px-4 py-4 text-sm font-bold shadow transition-all ${
                        viewMode === "charts" ? "bg-[#1D9E75] text-white" : "bg-white text-gray-500"
                      }`}
                    >
                      📊
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReorderMode(r => !r); setSelectMode(false); setViewMode("list"); }}
                      className={`rounded-2xl px-4 py-4 text-sm font-bold shadow transition-all ${
                        reorderMode ? "bg-[#1D9E75] text-white" : "bg-white text-gray-500"
                      }`}
                    >
                      ⇅ ترتيب
                    </button>
                    <button
                      type="button"
                      onClick={toggleSelectMode}
                      className="rounded-2xl bg-white px-4 py-4 text-sm font-bold text-gray-500 shadow transition-opacity hover:opacity-80"
                    >
                      تحديد
                    </button>
                  </>
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
                <span className="text-xl">{allCategoryIcons[filterCategory] ?? "💳"}</span>
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

          {/* ── الرسوم البيانية ── */}
          {viewMode === "charts" && !loading && selectedMonthExpenses.length > 0 && (
            <div className="space-y-4">
              <DonutChart
                categories={sortedCategories}
                total={currentMonthTotal}
                allCategoryIcons={allCategoryIcons}
              />
              <DailyBarsChart
                expenses={selectedMonthExpenses}
                monthKey={selectedMonthKey}
              />
            </div>
          )}

          {/* Expenses list */}
          <section className={`space-y-3 ${viewMode === "charts" ? "hidden" : ""}`}>
            {loading ? (
              <div className="flex justify-center py-10">
                <span className="size-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              </div>
            ) : visibleExpenses.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow">
                <p className="text-4xl">🧾</p>
                <p className="mt-3 font-semibold text-gray-600">
                  {searchActive
                    ? `ما لقينا نتائج لـ "${searchQuery.trim()}"`
                    : filterCategory ? `لا توجد مصاريف في ${filterCategory}` : "لا توجد مصاريف حتى الآن"}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {searchActive ? "جرب كلمة مختلفة" : filterCategory ? "" : "ارفع أول فاتورة وابدأ التتبع"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">

              {/* hint وضع الترتيب */}
              {reorderMode && (
                <div className="rounded-2xl bg-white/20 px-4 py-2.5 text-center">
                  <p className="text-xs font-semibold text-white">اسحب ⠿ لتغيير ترتيب المصاريف بنفس اليوم</p>
                </div>
              )}

              {(reorderMode ? sortedDays : ["_all"]).flatMap(dayKey => {
                const dayExpenses = reorderMode
                  ? getOrderedDayExpenses(dayGroups[dayKey] ?? [], dayKey)
                  : visibleExpenses;

                const dayHeader = reorderMode ? (
                  <div key={`hdr-${dayKey}`} className="flex items-center gap-2 px-1 pt-1">
                    <span className="text-xs font-bold text-white/80">📅 {formatDate(dayKey)}</span>
                    <div className="flex-1 h-px bg-white/20" />
                    <span className="text-xs text-white/50">{dayExpenses.length} مصروف</span>
                  </div>
                ) : null;

                const cards = dayExpenses.map((expense) => {
                    const isSelected = selected.has(expense.id);
                    const isExpanded = expandedId === expense.id;
                    const hasItems   = Array.isArray(expense.items) && expense.items.length > 0;
                    const hasDetail  = hasItems || expense.item_name || expense.item_brand;
                    const isDragging = draggingId === String(expense.id);

                    return (
                      <article
                        key={expense.id}
                        data-drag-id={String(expense.id)}
                        className={`rounded-2xl bg-white shadow transition-all overflow-hidden ${
                          isSelected ? "ring-2 ring-[#1D9E75]" : ""
                        } ${isExpanded ? "ring-1 ring-[#1D9E75]/30" : ""} ${
                          isDragging ? "opacity-50 scale-[0.98] ring-2 ring-[#1D9E75]" : ""
                        }`}
                      >
                        {/* الصف الرئيسي */}
                        <div
                          onClick={() => {
                            if (reorderMode) return;
                            if (selectMode) { toggleItem(expense.id); return; }
                            setExpandedId(isExpanded ? null : expense.id);
                          }}
                          className={`flex items-center gap-4 p-4 ${reorderMode ? "cursor-default" : "cursor-pointer"}`}
                        >
                          {/* مقبض السحب في وضع الترتيب */}
                          {reorderMode && (
                            <div
                              className="flex-shrink-0 flex size-10 items-center justify-center rounded-xl bg-gray-50 text-gray-400 text-xl cursor-grab active:cursor-grabbing touch-none select-none"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.currentTarget.setPointerCapture(e.pointerId);
                                pointerDragRef.current = { id: String(expense.id), dateKey: expense.date ?? "غير محدد" };
                                setDraggingId(String(expense.id));
                              }}
                              onPointerMove={(e) => {
                                if (!pointerDragRef.current) return;
                                e.preventDefault();
                                const card = document.querySelector(`[data-drag-id="${pointerDragRef.current.id}"]`) as HTMLElement | null;
                                if (card) card.style.pointerEvents = "none";
                                const under = document.elementFromPoint(e.clientX, e.clientY);
                                const overCard = under?.closest("[data-drag-id]");
                                const overId = overCard?.getAttribute("data-drag-id");
                                if (card) card.style.pointerEvents = "";
                                if (overId && overId !== pointerDragRef.current.id) {
                                  moveItemAndUpdate(pointerDragRef.current.dateKey, pointerDragRef.current.id, overId);
                                }
                              }}
                              onPointerUp={() => { pointerDragRef.current = null; setDraggingId(null); }}
                              onPointerCancel={() => { pointerDragRef.current = null; setDraggingId(null); }}
                            >
                              ⠿
                            </div>
                          )}

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

                          {/* Amount + score badge + expand indicator */}
                          <div className="flex flex-shrink-0 flex-col items-end gap-1">
                            <p className="text-lg font-extrabold text-[#1D9E75]">
                              {toNumber(expense.amount).toFixed(2)}
                              <span className="mr-0.5 text-xs font-normal text-gray-400">ر.س</span>
                            </p>
                            {/* شارة التقييم الصغيرة */}
                            {!selectMode && (() => {
                              const sc = scoreExpense(expense);
                              const lb = scoreLabel(sc);
                              return (
                                <span className={`text-xs font-bold ${lb.color}`}>
                                  {sc}/10
                                </span>
                              );
                            })()}
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

                            {/* أزرار التعديل والحذف */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openEdit(expense); }}
                                className="flex-1 rounded-xl border border-[#1D9E75]/30 py-2 text-sm font-bold text-[#1D9E75] transition-colors hover:bg-[#1D9E75]/5"
                              >
                                ✏️ تعديل
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); void handleDeleteSingle(expense.id); }}
                                className="flex-1 rounded-xl border border-red-200 py-2 text-sm font-bold text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                🗑 حذف
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  });

                  return reorderMode ? [dayHeader, ...cards] : cards;
              })}
              </div>
            )}
          </section>
        </div>
      </main>
      <BottomNav />

      {/* ── Modal التعديل ── */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* خلفية معتمة */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditingExpense(null)}
          />

          {/* البطاقة */}
          <div className="relative w-full max-w-xl rounded-t-3xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: "90dvh" }}>
            {/* Header ثابت */}
            <div className="px-5 pt-5 pb-3 flex-shrink-0">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-gray-800">تعديل الفاتورة</h2>
                <button
                  onClick={() => setEditingExpense(null)}
                  className="rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200"
                >✕</button>
              </div>
            </div>

            {/* المحتوى القابل للتمرير */}
            <div className="overflow-y-auto flex-1 px-5 pb-4">
            <div className="space-y-4">
              {/* اسم المحل */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">🏪 اسم المحل</label>
                <input
                  type="text"
                  value={editStore}
                  onChange={e => setEditStore(e.target.value)}
                  placeholder="مثال: ستاربكس"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
              </div>

              {/* المبلغ */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">💰 المبلغ (ر.س)</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
              </div>

              {/* التاريخ */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">📅 التاريخ</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
              </div>

              {/* التصنيف */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">🏷️ التصنيف</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(allCategoryIcons).map(([cat, icon]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditCategory(cat)}
                      className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 text-xs font-semibold transition-all ${
                        editCategory === cat
                          ? "bg-[#1D9E75] text-white"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-lg">{icon}</span>
                      <span className="truncate w-full text-center">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── مؤشر التقييم الحي — فوق قسم الأصناف مباشرة ── */}
              {(() => {
                const oldSc = editingExpense ? scoreExpense(editingExpense) : 1;
                const newSc = computeEditScore();
                const newLb = scoreLabel(newSc);
                return (
                  <div className={`rounded-2xl px-4 py-3 ${newSc >= 8 ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{newLb.emoji}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-700">تقييم جودة البيانات</p>
                          <p className={`text-xs ${newLb.color}`}>{newLb.text}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 font-extrabold">
                        {newSc !== oldSc && (
                          <span className="text-gray-300 line-through text-xs">{oldSc}/10</span>
                        )}
                        <span className={`text-base ${newLb.color}`}>{newSc}/10</span>
                      </div>
                    </div>
                    {newSc < 8 && (
                      <p className="mt-2 text-xs text-amber-700 bg-amber-100 rounded-xl px-3 py-2">
                        👇 {newSc <= 3
                          ? "اضغط \"+ أضف صنف\" أدناه وأضف الأصناف مع أسعارها لترفع تقييمك إلى 10/10"
                          : newSc <= 5
                          ? "أكمل تفاصيل الأصناف بالكمية والسعر لترفع تقييمك"
                          : "أكمل بيانات الأصناف (السعر والكمية) للوصول إلى 10/10"}
                      </p>
                    )}
                    {newSc === 10 && oldSc < 10 && (
                      <p className="mt-2 text-xs text-emerald-700 bg-emerald-100 rounded-xl px-3 py-2">
                        🎉 ممتاز! وصلت إلى أعلى تقييم — جاهز للحفظ
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* الأصناف */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500">🛒 الأصناف</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="rounded-xl bg-[#1D9E75] px-4 py-1.5 text-xs font-bold text-white shadow hover:opacity-90"
                  >+ أضف صنف</button>
                </div>

                {editItems.length === 0 && (
                  <p className="rounded-2xl bg-gray-50 py-4 text-center text-xs text-gray-400">
                    لا توجد أصناف — اضغط <span className="font-bold text-[#1D9E75]">+ أضف صنف</span> لإضافتها
                  </p>
                )}

                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                      {/* اسم الصنف */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => updateItem(idx, "name", e.target.value)}
                          placeholder="اسم الصنف"
                          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1D9E75]"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="rounded-xl bg-red-50 px-2 py-2 text-red-400 hover:bg-red-100"
                        >✕</button>
                      </div>

                      {/* الماركة */}
                      <input
                        type="text"
                        value={item.brand}
                        onChange={e => updateItem(idx, "brand", e.target.value)}
                        placeholder="الماركة (اختياري)"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1D9E75]"
                      />

                      {/* الكمية والسعر */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="mb-1 text-xs text-gray-400">الكمية</p>
                          <input
                            type="number"
                            value={item.quantity}
                            min={1}
                            onChange={e => {
                              updateItem(idx, "quantity", parseFloat(e.target.value) || 1);
                              setTimeout(() => recalcTotalFromItems(editItems), 10);
                            }}
                            className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-center text-sm text-gray-800 outline-none focus:border-[#1D9E75]"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-gray-400">سعر الوحدة</p>
                          <input
                            type="number"
                            value={item.unit_price}
                            min={0}
                            step={0.01}
                            onChange={e => {
                              updateItem(idx, "unit_price", parseFloat(e.target.value) || 0);
                              setTimeout(() => recalcTotalFromItems(editItems), 10);
                            }}
                            className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-center text-sm text-gray-800 outline-none focus:border-[#1D9E75]"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-gray-400">الإجمالي</p>
                          <input
                            type="number"
                            value={item.total_price}
                            min={0}
                            step={0.01}
                            onChange={e => updateItem(idx, "total_price", parseFloat(e.target.value) || 0)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-center text-sm font-bold text-[#1D9E75] outline-none focus:border-[#1D9E75]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* زر إعادة حساب المجموع */}
                {editItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => recalcTotalFromItems(editItems)}
                    className="mt-2 w-full rounded-xl bg-[#1D9E75]/8 py-2 text-xs font-semibold text-[#1D9E75] hover:bg-[#1D9E75]/15"
                  >
                    🔄 إعادة حساب المجموع من الأصناف
                  </button>
                )}
              </div>

            </div>
            </div>

            {/* زر الحفظ ثابت في الأسفل */}
            <div className="flex-shrink-0 px-5 pb-8 pt-3 border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={saving}
                className="w-full rounded-2xl bg-[#1D9E75] py-4 text-base font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : "💾 حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}

/* ═══════════════════════════════════════════════
   مكوّن: Donut Chart — توزيع التصنيفات
═══════════════════════════════════════════════ */
function DonutChart({
  categories,
  total,
  allCategoryIcons,
}: {
  categories: [string, { total: number; count: number }][];
  total: number;
  allCategoryIcons: Record<string, string>;
}) {
  const cx = 100; const cy = 100;
  const R = 78;  // نصف قطر خارجي
  const r = 50;  // نصف قطر داخلي (الثقب)
  const circ = 2 * Math.PI * R;

  /* احسب arc path لكل تصنيف */
  type Segment = { cat: string; total: number; count: number; color: string; startAngle: number; endAngle: number };
  const segments: Segment[] = [];
  let cumAngle = -90; // ابدأ من أعلى

  categories.forEach(([cat, { total: t, count }], idx) => {
    const angle = total > 0 ? (t / total) * 360 : 0;
    segments.push({
      cat, total: t, count,
      color: catColor(cat, idx),
      startAngle: cumAngle,
      endAngle: cumAngle + angle,
    });
    cumAngle += angle;
  });

  function polar(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function donutPath(startAngle: number, endAngle: number): string {
    // لو الزاوية صغيرة جداً تجاهل
    if (endAngle - startAngle < 0.5) return "";
    // لو تقريباً دائرة كاملة، تجنب خلل SVG
    const sweep = Math.min(endAngle - startAngle, 359.9);
    const endA = startAngle + sweep;
    const outerS = polar(startAngle, R);
    const outerE = polar(endA, R);
    const innerS = polar(startAngle, r);
    const innerE = polar(endA, r);
    const large = sweep > 180 ? 1 : 0;
    return [
      `M ${outerS.x.toFixed(2)} ${outerS.y.toFixed(2)}`,
      `A ${R} ${R} 0 ${large} 1 ${outerE.x.toFixed(2)} ${outerE.y.toFixed(2)}`,
      `L ${innerE.x.toFixed(2)} ${innerE.y.toFixed(2)}`,
      `A ${r} ${r} 0 ${large} 0 ${innerS.x.toFixed(2)} ${innerS.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-lg space-y-4">
      <p className="text-sm font-extrabold text-gray-700">🥧 توزيع المصاريف حسب التصنيف</p>

      {/* الرسم الدائري */}
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 200 200" className="w-44 h-44 flex-shrink-0 drop-shadow-sm">
          {segments.map(seg => (
            <path
              key={seg.cat}
              d={donutPath(seg.startAngle, seg.endAngle)}
              fill={seg.color}
              stroke="white"
              strokeWidth="2"
            />
          ))}
          {/* نص المجموع في المركز */}
          <text x="100" y="94" textAnchor="middle" className="text-sm" fontSize="13" fontWeight="800" fill="#374151">
            {total.toFixed(0)}
          </text>
          <text x="100" y="112" textAnchor="middle" fontSize="9" fill="#9CA3AF" fontWeight="600">
            ر.س
          </text>
        </svg>

        {/* أسطورة */}
        <div className="flex-1 space-y-1.5 min-w-0">
          {segments.map(seg => (
            <div key={seg.cat} className="flex items-center gap-2">
              <span className="flex-shrink-0 size-3 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="text-xs font-medium text-gray-600 truncate flex-1">
                {allCategoryIcons[seg.cat] ?? "💳"} {seg.cat}
              </span>
              <span className="text-xs font-bold text-gray-800 tabular-nums flex-shrink-0">
                {total > 0 ? ((seg.total / total) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* أشرطة التصنيفات */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        {segments.map(seg => (
          <div key={seg.cat} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-600">
                {allCategoryIcons[seg.cat] ?? "💳"} {seg.cat}
                <span className="text-gray-400 font-normal mr-1">({seg.count}×)</span>
              </span>
              <span className="font-extrabold tabular-nums" style={{ color: catColor(seg.cat, segments.indexOf(seg)) }}>
                {seg.total.toFixed(2)} ر.س
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${total > 0 ? (seg.total / total) * 100 : 0}%`,
                  backgroundColor: catColor(seg.cat, segments.indexOf(seg)),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   مكوّن: Daily Bars — إنفاق كل يوم في الشهر
═══════════════════════════════════════════════ */
function DailyBarsChart({
  expenses,
  monthKey,
}: {
  expenses: { date: string | null; amount: number | null; category: string | null }[];
  monthKey: string;
}) {
  /* عدد أيام الشهر */
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year!, month!, 0).getDate();

  /* مجموع كل يوم */
  const dayTotals: number[] = Array(daysInMonth).fill(0);
  const dayCats: (string | null)[] = Array(daysInMonth).fill(null);

  for (const exp of expenses) {
    if (!exp.date) continue;
    const day = parseInt(exp.date.split("-")[2] ?? "0");
    if (day >= 1 && day <= daysInMonth) {
      dayTotals[day - 1]! += Math.abs(Number(exp.amount) || 0);
      // أعلى تصنيف لليوم (بسيط: آخر واحد)
      if (exp.category) dayCats[day - 1] = exp.category;
    }
  }

  const maxVal = Math.max(...dayTotals, 1);

  /* اليوم الحالي */
  const todayDay = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }).split("-")[2];
  const todayNum = todayDay ? parseInt(todayDay) : -1;

  const activedays = dayTotals.filter(v => v > 0).length;
  const totalSpent = dayTotals.reduce((a, b) => a + b, 0);
  const avgDay = activedays > 0 ? totalSpent / activedays : 0;

  /* SVG dimensions */
  const BAR_W = 8;
  const BAR_GAP = 3;
  const CHART_H = 80;
  const svgW = daysInMonth * (BAR_W + BAR_GAP);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold text-gray-700">📅 الإنفاق اليومي</p>
        <div className="text-left">
          <p className="text-xs text-gray-400">متوسط يوم نشط</p>
          <p className="text-sm font-bold text-[#1D9E75] tabular-nums">{avgDay.toFixed(1)} ر.س</p>
        </div>
      </div>

      {/* SVG bars */}
      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${svgW} ${CHART_H + 18}`}
          width={Math.max(svgW, 300)}
          height={CHART_H + 18}
          style={{ minWidth: svgW }}
        >
          {dayTotals.map((val, i) => {
            const barH = val > 0 ? Math.max(4, (val / maxVal) * CHART_H) : 2;
            const x = i * (BAR_W + BAR_GAP);
            const y = CHART_H - barH;
            const isToday = (i + 1) === todayNum;
            const cat = dayCats[i];
            const color = val > 0
              ? (cat ? catColor(cat, 0) : "#1D9E75")
              : "#E5E7EB";
            const dayLabel = String(i + 1);

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={barH}
                  rx="2"
                  fill={isToday ? "#1D9E75" : color}
                  opacity={val > 0 ? 1 : 0.4}
                />
                {/* اليوم الحالي — نقطة */}
                {isToday && (
                  <circle cx={x + BAR_W / 2} cy={y - 4} r="2.5" fill="#1D9E75" />
                )}
                {/* رقم اليوم — كل 5 أيام */}
                {(i === 0 || (i + 1) % 5 === 0 || i + 1 === daysInMonth) && (
                  <text
                    x={x + BAR_W / 2}
                    y={CHART_H + 12}
                    textAnchor="middle"
                    fontSize="7"
                    fill={isToday ? "#1D9E75" : "#9CA3AF"}
                    fontWeight={isToday ? "800" : "400"}
                  >
                    {dayLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* خط المتوسط */}
          {avgDay > 0 && (
            <line
              x1="0"
              y1={CHART_H - (avgDay / maxVal) * CHART_H}
              x2={svgW}
              y2={CHART_H - (avgDay / maxVal) * CHART_H}
              stroke="#1D9E75"
              strokeWidth="0.8"
              strokeDasharray="3 2"
              opacity="0.5"
            />
          )}
        </svg>
      </div>

      {/* أعلى يوم إنفاق */}
      {(() => {
        const maxIdx = dayTotals.indexOf(maxVal);
        return maxVal > 0 ? (
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs">
            <span className="text-gray-500">أعلى يوم إنفاق: {maxIdx + 1} {["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][(month ?? 1) - 1]}</span>
            <span className="font-extrabold text-red-500 tabular-nums">{maxVal.toFixed(2)} ر.س</span>
          </div>
        ) : null;
      })()}
    </div>
  );
}
