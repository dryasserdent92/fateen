"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { apiUrl } from "../../lib/api-client";
import AuthGuard from "../components/auth-guard";
import BottomNav from "../components/bottom-nav";

/* ──────────────── أنواع البيانات ──────────────── */
type ItemEntry = {
  name: string;
  brand: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type ExpenseRow = {
  id: number | string;
  store: string | null;
  date: string | null;
  items: ItemEntry[] | null;
  item_name: string | null;
  amount: number | null;
};

type Purchase = {
  store: string | null;
  unit_price: number;
  quantity: number;
  date: string | null;
};

type CompareItem = {
  name: string;
  storeStats: { store: string; avgPrice: number; minPrice: number; count: number }[];
  cheapestStore: string;
  mostExpensiveStore: string;
  priceDiff: number;
  totalSpent: number;
  potentialSavings: number;
  allPurchases: Purchase[];
};

type HabitItem = {
  name: string;
  count: number;
  avgPrice: number;
  totalSpent: number;
  stores: string[];
  lastDate: string | null;
};

type AnalysisResult = {
  compareItems: CompareItem[];
  habitItems: HabitItem[];
  totalSavings: number;
};

/* صنف قابل للاختيار في أداة المقارنة */
type SelectableItem = {
  uid: string;
  name: string;
  brand: string | null;
  unit_price: number;
  quantity: number;
  store: string | null;
  date: string | null;
};

type CompareResult = {
  comparable: boolean;
  item1_unit_count: number | null;
  item2_unit_count: number | null;
  item3_unit_count: number | null;
  item1_price_per_unit: number | null;
  item2_price_per_unit: number | null;
  item3_price_per_unit: number | null;
  winner: 1 | 2 | 3 | null;
  savings_percent: number | null;
  unit_label: string | null;
  message: string;
};

/* ──────────────── مساعدات ──────────────── */
function toNumber(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ar-EG-u-nu-latn", {
    month: "short", day: "numeric",
    timeZone: "Asia/Riyadh", calendar: "gregory",
  });
}

/* ── تحليل الأصناف المتكررة ── */
function analyzeExpenses(expenses: ExpenseRow[]): AnalysisResult {
  const map = new Map<string, { displayName: string; purchases: Purchase[] }>();

  for (const exp of expenses) {
    if (!Array.isArray(exp.items) || exp.items.length === 0) continue;
    for (const item of exp.items) {
      if (!item.name?.trim()) continue;
      const key = normalizeName(item.name);
      if (!map.has(key)) map.set(key, { displayName: item.name.trim(), purchases: [] });
      map.get(key)!.purchases.push({
        store: exp.store?.trim() || null,
        unit_price: toNumber(item.unit_price),
        quantity: Math.max(1, toNumber(item.quantity)),
        date: exp.date,
      });
    }
  }

  const compareItems: CompareItem[] = [];
  const habitItems: HabitItem[] = [];

  for (const [, { displayName, purchases }] of map) {
    if (purchases.length < 2) continue;

    /* إزالة التكرار: نفس التاريخ + نفس السعر */
    const seen = new Set<string>();
    const deduped: Purchase[] = [];
    for (const p of purchases) {
      const dk = `${p.date ?? ""}__${p.unit_price.toFixed(2)}`;
      if (!seen.has(dk)) { seen.add(dk); deduped.push(p); }
    }
    if (deduped.length < 2) continue;

    const uniqueStores = new Set(deduped.map(p => p.store ?? "").filter(Boolean));
    const uniquePrices = new Set(deduped.map(p => Math.round(p.unit_price * 100)));
    const prices = deduped.map(p => p.unit_price).filter(p => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const priceDiff = maxPrice - minPrice;
    const totalSpent = deduped.reduce((s, p) => s + p.unit_price * p.quantity, 0);
    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const lastDate = [...deduped].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0]?.date ?? null;

    if (uniqueStores.size >= 2 && uniquePrices.size >= 2 && priceDiff > 0.5) {
      const storeMap = new Map<string, number[]>();
      for (const p of deduped) {
        if (!p.store || p.unit_price <= 0) continue;
        if (!storeMap.has(p.store)) storeMap.set(p.store, []);
        storeMap.get(p.store)!.push(p.unit_price);
      }
      const storeStats = Array.from(storeMap.entries()).map(([store, sp]) => ({
        store, avgPrice: sp.reduce((a, b) => a + b, 0) / sp.length,
        minPrice: Math.min(...sp), count: sp.length,
      })).sort((a, b) => a.avgPrice - b.avgPrice);

      if (storeStats.length >= 2) {
        const cheapestAvg = storeStats[0]!.avgPrice;
        const potentialSavings = Math.max(0, deduped.reduce((s, p) => s + (p.unit_price - cheapestAvg) * p.quantity, 0));
        compareItems.push({
          name: displayName, storeStats,
          cheapestStore: storeStats[0]!.store,
          mostExpensiveStore: storeStats[storeStats.length - 1]!.store,
          priceDiff, totalSpent, potentialSavings, allPurchases: deduped,
        });
        continue;
      }
    }
    habitItems.push({ name: displayName, count: deduped.length, avgPrice, totalSpent, stores: Array.from(uniqueStores), lastDate });
  }

  compareItems.sort((a, b) => b.potentialSavings - a.potentialSavings || b.priceDiff - a.priceDiff);
  habitItems.sort((a, b) => b.count - a.count);
  return { compareItems, habitItems, totalSavings: compareItems.reduce((s, i) => s + i.potentialSavings, 0) };
}

/* ── جمع كل الأصناف القابلة للاختيار ── */
function buildSelectableItems(expenses: ExpenseRow[]): SelectableItem[] {
  const items: SelectableItem[] = [];
  const seen = new Set<string>();

  for (const exp of expenses) {
    /* أصناف من items array */
    if (Array.isArray(exp.items) && exp.items.length > 0) {
      for (const item of exp.items) {
        if (!item.name?.trim()) continue;
        /* المفتاح يشمل id الفاتورة لتجنب دمج أصناف مختلفة بنفس الاسم والسعر */
        const key = `${exp.id}__${normalizeName(item.name)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        /* لو السعر صفر نرجع للمبلغ الكلي كبديل */
        const price = toNumber(item.unit_price) > 0
          ? toNumber(item.unit_price)
          : toNumber(item.total_price) > 0
          ? toNumber(item.total_price)
          : toNumber(exp.amount);
        items.push({
          uid: `${exp.id}-${normalizeName(item.name)}`,
          name: item.name.trim(),
          brand: item.brand,
          unit_price: price,
          quantity: Math.max(1, toNumber(item.quantity)),
          store: exp.store?.trim() || null,
          date: exp.date,
        });
      }
    }
    /* صنف واحد من item_name */
    else if (exp.item_name?.trim()) {
      const key = `${exp.id}__single`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          uid: `${exp.id}-single`,
          name: exp.item_name.trim(),
          brand: null,
          unit_price: toNumber(exp.amount),
          quantity: 1,
          store: exp.store?.trim() || null,
          date: exp.date,
        });
      }
    }
  }

  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/* ──────────────── المكوّن الرئيسي ──────────────── */
export default function SmartPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult>({ compareItems: [], habitItems: [], totalSavings: 0 });
  const [selectableItems, setSelectableItems] = useState<SelectableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"analysis" | "compare">("analysis");

  /* تاب التحليل */
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [expandedCompare, setExpandedCompare] = useState<string | null>(null);
  const [showAllHabits, setShowAllHabits] = useState(false);

  /* تاب المقارنة */
  const [slot1, setSlot1] = useState<SelectableItem | null>(null);
  const [slot2, setSlot2] = useState<SelectableItem | null>(null);
  const [slot3, setSlot3] = useState<SelectableItem | null>(null);
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");
  const [search3, setSearch3] = useState("");
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3 | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from("expenses")
      .select("id,store,date,items,item_name,amount")
      .eq("user_id", session.user.id)
      .order("date", { ascending: false });

    const rows = (data ?? []) as ExpenseRow[];
    setExpenses(rows);
    setAnalysis(analyzeExpenses(rows));
    setSelectableItems(buildSelectableItems(rows));
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const { compareItems, habitItems, totalSavings } = analysis;
  const itemsWithItems = expenses.filter(e => Array.isArray(e.items) && e.items!.length > 0).length;

  /* نصيحة عمار */
  async function askAmmar() {
    if (loadingAdvice || compareItems.length === 0) return;
    setLoadingAdvice(true); setAdviceError(null); setAdvice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
      const payload = compareItems.slice(0, 8).map(({ allPurchases: _p, ...r }) => r);
      const res = await fetch(apiUrl("/api/advice"), { method: "POST", headers, body: JSON.stringify({ items: payload }) });
      if (!res.ok) { const e = (await res.json()) as { error?: string }; throw new Error(e.error ?? "خطأ"); }
      const json = (await res.json()) as { advice?: string };
      setAdvice(json.advice ?? "ما رد عمار، جرب ثانياً.");
    } catch (e) { setAdviceError(e instanceof Error ? e.message : "فشل الاتصال"); }
    finally { setLoadingAdvice(false); }
  }

  /* مقارنة الأصناف */
  async function runCompare() {
    if (!slot1 || !slot2 || loadingCompare) return;
    setLoadingCompare(true); setCompareError(null); setCompareResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
      const res = await fetch(apiUrl("/api/compare"), {
        method: "POST", headers,
        body: JSON.stringify({ item1: slot1, item2: slot2, item3: slot3 ?? null }),
      });
      if (!res.ok) { const e = (await res.json()) as { error?: string }; throw new Error(e.error ?? "خطأ"); }
      const json = (await res.json()) as CompareResult;
      setCompareResult(json);
    } catch (e) { setCompareError(e instanceof Error ? e.message : "فشل الاتصال"); }
    finally { setLoadingCompare(false); }
  }

  /* فلترة البحث */
  const filterItems = (q: string) =>
    q.trim().length > 0
      ? selectableItems.filter(i => i.name.includes(q.trim()) || (i.store ?? "").includes(q.trim()))
      : [];
  const filtered1 = filterItems(search1);
  const filtered2 = filterItems(search2);
  const filtered3 = filterItems(search3);

  function selectForSlot(item: SelectableItem, slot: 1 | 2 | 3) {
    if (slot === 1) { setSlot1(item); setSearch1(""); }
    else if (slot === 2) { setSlot2(item); setSearch2(""); }
    else { setSlot3(item); setSearch3(""); }
    setActiveSlot(null);
    setCompareResult(null);
    setCompareError(null);
  }

  /* Skeleton */
  if (loading) {
    return (
      <AuthGuard>
        <main className="min-h-screen bg-[#0F172A] pb-28 font-sans">
          <SmartHeader />
          <div className="px-4 pt-4 space-y-3 mx-auto max-w-xl">
            {[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/10" />)}
          </div>
        </main>
        <BottomNav />
      </AuthGuard>
    );
  }

  const habitsToShow = showAllHabits ? habitItems : habitItems.slice(0, 4);
  const canCompare = !!slot1 && !!slot2;

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#0F172A] pb-28 font-sans">
        <SmartHeader />

        {/* ── تبويب ── */}
        <div className="sticky top-0 z-10 bg-[#0F172A] px-4 pb-3 pt-1">
          <div className="flex gap-2 mx-auto max-w-xl rounded-2xl bg-white/8 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("analysis")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                activeTab === "analysis"
                  ? "bg-white text-[#0F172A] shadow"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              🔍 فرص التوفير
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                activeTab === "compare"
                  ? "bg-white text-[#0F172A] shadow"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              ⚖️ قارن الأصناف
            </button>
          </div>
        </div>

        {/* ════════════ تاب: فرص التوفير ════════════ */}
        {activeTab === "analysis" && (
          <div className="px-4 space-y-5 mx-auto max-w-xl">

            {compareItems.length === 0 && habitItems.length === 0 && (
              <div className="rounded-3xl bg-white/10 p-8 text-center space-y-3 mt-2">
                <div className="text-5xl">🔍</div>
                <p className="text-lg font-bold text-white">
                  {itemsWithItems === 0 ? "ما فيه أصناف بعد" : "ما فيه أصناف متكررة بعد"}
                </p>
                <p className="text-sm text-white/60">
                  {itemsWithItems === 0
                    ? "لمّا تضيف مصاريف بتفاصيل الأصناف، راح يحللها عمار ويوريك فرص التوفير"
                    : "كل صنف اشتريته مرة واحدة فقط حتى الآن"}
                </p>
              </div>
            )}

            {totalSavings > 0.5 && (
              <div className="rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 p-5 mt-2">
                <p className="text-xs font-bold text-emerald-400 mb-1">💡 فرصة التوفير المحتملة</p>
                <p className="text-3xl font-extrabold text-emerald-300">
                  {totalSavings.toFixed(1)}
                  <span className="mr-1 text-base font-semibold text-emerald-400/70">ر.س</span>
                </p>
                <p className="text-xs text-white/50 mt-1">
                  لو اشتريت دايماً من الأرخص — {compareItems.length} صنف من محلات مختلفة
                </p>
              </div>
            )}

            {compareItems.length > 0 && (
              <div className="rounded-3xl bg-white/8 border border-white/10 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl shadow-lg">🧙</div>
                  <div>
                    <p className="text-sm font-extrabold text-white">عمار</p>
                    <p className="text-xs text-white/50">مستشارك المالي الذكي</p>
                  </div>
                </div>
                {advice ? (
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-sm leading-relaxed text-white/90 whitespace-pre-line">{advice}</p>
                  </div>
                ) : adviceError ? (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                    <p className="text-sm text-red-300">{adviceError}</p>
                  </div>
                ) : (
                  <p className="text-xs text-white/50">عندي {compareItems.length} صنف — اضغط وأوريك وين تقدر توفر</p>
                )}
                <button type="button" onClick={() => void askAmmar()} disabled={loadingAdvice}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/40 transition-opacity hover:opacity-90 disabled:opacity-60 active:scale-[0.98]">
                  {loadingAdvice ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      عمار يحلل...
                    </span>
                  ) : advice ? "🔄 طلب نصيحة جديدة" : "🔮 اطلب نصيحة عمار"}
                </button>
              </div>
            )}

            {compareItems.length > 0 && (
              <section className="space-y-2">
                <p className="px-1 text-xs font-bold text-white/50">⚖️ مقارنة المحلات ({compareItems.length})</p>
                {compareItems.map(item => (
                  <CompareCard key={item.name} item={item}
                    expanded={expandedCompare === item.name}
                    onToggle={() => setExpandedCompare(expandedCompare === item.name ? null : item.name)} />
                ))}
              </section>
            )}

            {habitItems.length > 0 && (
              <section className="space-y-2">
                <p className="px-1 text-xs font-bold text-white/50">🔁 عاداتك الشرائية ({habitItems.length})</p>
                <p className="px-1 text-xs text-white/30">أصناف تشتريها بانتظام — ما في فرق سعر كافٍ بين المحلات</p>
                <div className="space-y-1.5">
                  {habitsToShow.map(item => <HabitCard key={item.name} item={item} />)}
                </div>
                {habitItems.length > 4 && (
                  <button type="button" onClick={() => setShowAllHabits(v => !v)}
                    className="w-full rounded-2xl bg-white/5 py-3 text-xs font-semibold text-white/50 hover:bg-white/10 transition-colors">
                    {showAllHabits ? "▲ عرض أقل" : `▼ عرض الكل (${habitItems.length})`}
                  </button>
                )}
              </section>
            )}

          </div>
        )}

        {/* ════════════ تاب: قارن الأصناف ════════════ */}
        {activeTab === "compare" && (
          <div className="px-4 space-y-4 mx-auto max-w-xl">

            <p className="px-1 text-xs text-white/40">
              اختر صنفين أو ثلاثة من مشترياتك وعمار يحسب لك الأفضل قيمةً للريال بسعر الوحدة
            </p>

            {/* ── الصنف الأول ── */}
            <ItemSlot
              slotNumber={1}
              selected={slot1}
              search={search1}
              onSearchChange={(v) => { setSearch1(v); setActiveSlot(1); if (!v) setActiveSlot(null); }}
              onFocus={() => setActiveSlot(1)}
              isActive={activeSlot === 1}
              results={filtered1}
              onSelect={(item) => selectForSlot(item, 1)}
              onClear={() => { setSlot1(null); setSearch1(""); setCompareResult(null); }}
            />

            {/* ── الصنف الثاني ── */}
            <ItemSlot
              slotNumber={2}
              selected={slot2}
              search={search2}
              onSearchChange={(v) => { setSearch2(v); setActiveSlot(2); if (!v) setActiveSlot(null); }}
              onFocus={() => setActiveSlot(2)}
              isActive={activeSlot === 2}
              results={filtered2}
              onSelect={(item) => selectForSlot(item, 2)}
              onClear={() => { setSlot2(null); setSearch2(""); setCompareResult(null); }}
            />

            {/* ── الصنف الثالث (اختياري) ── */}
            <div className="space-y-2">
              {slot3 ? (
                <ItemSlot
                  slotNumber={3}
                  selected={slot3}
                  search={search3}
                  onSearchChange={(v) => { setSearch3(v); setActiveSlot(3); if (!v) setActiveSlot(null); }}
                  onFocus={() => setActiveSlot(3)}
                  isActive={activeSlot === 3}
                  results={filtered3}
                  onSelect={(item) => selectForSlot(item, 3)}
                  onClear={() => { setSlot3(null); setSearch3(""); setCompareResult(null); }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setSearch3(""); setActiveSlot(3); setSlot3(null); }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/4 py-3 text-sm text-white/40 hover:border-white/40 hover:text-white/60 transition-all"
                >
                  <span className="text-lg">＋</span>
                  <span>أضف صنفاً ثالثاً (اختياري)</span>
                </button>
              )}
              {/* مربع بحث الصنف الثالث لما يضغط الزر ولم يُختر بعد */}
              {!slot3 && activeSlot === 3 && (
                <ItemSlot
                  slotNumber={3}
                  selected={null}
                  search={search3}
                  onSearchChange={(v) => { setSearch3(v); }}
                  onFocus={() => setActiveSlot(3)}
                  isActive={true}
                  results={filtered3}
                  onSelect={(item) => selectForSlot(item, 3)}
                  onClear={() => { setSearch3(""); setActiveSlot(null); }}
                />
              )}
            </div>

            {/* ── زر القارن ── */}
            <button
              type="button"
              onClick={() => void runCompare()}
              disabled={!canCompare || loadingCompare}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-base font-bold text-white shadow-lg shadow-orange-900/30 transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
            >
              {loadingCompare ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  عمار يحسب...
                </span>
              ) : slot3 ? "⚖️ قارن الأصناف الثلاثة" : "⚖️ قارن الصنفين"}
            </button>

            {/* ── خطأ ── */}
            {compareError && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-300">{compareError}</p>
              </div>
            )}

            {/* ── نتيجة المقارنة ── */}
            {compareResult && slot1 && slot2 && (
              <CompareResultCard result={compareResult} item1={slot1} item2={slot2} item3={slot3} />
            )}

            {/* placeholder لو ما في أصناف بعد */}
            {selectableItems.length === 0 && (
              <div className="rounded-3xl bg-white/8 p-8 text-center space-y-2 mt-2">
                <div className="text-4xl">📦</div>
                <p className="text-sm font-bold text-white/70">ما فيه أصناف بعد</p>
                <p className="text-xs text-white/40">أضف مصاريف بتفاصيل الأصناف وارجع هنا للمقارنة</p>
              </div>
            )}

          </div>
        )}

      </main>
      <BottomNav />
    </AuthGuard>
  );
}

/* ── Header ── */
function SmartHeader() {
  return (
    <div className="px-5 pt-10 pb-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl shadow-lg">💰</div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">وفّرلي</h1>
          <p className="text-xs text-white/50">مقارنة الأسعار وتحليل عاداتك الشرائية</p>
        </div>
      </div>
    </div>
  );
}

/* ── مربع اختيار الصنف ── */
function ItemSlot({
  slotNumber, selected, search, onSearchChange, onFocus,
  isActive, results, onSelect, onClear,
}: {
  slotNumber: 1 | 2 | 3;
  selected: SelectableItem | null;
  search: string;
  onSearchChange: (v: string) => void;
  onFocus: () => void;
  isActive: boolean;
  results: SelectableItem[];
  onSelect: (item: SelectableItem) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slotColors = [
    "bg-violet-500/30 text-violet-300",
    "bg-amber-500/30 text-amber-300",
    "bg-sky-500/30 text-sky-300",
  ] as const;
  const slotNames = ["الأول", "الثاني", "الثالث"] as const;

  return (
    <div className="rounded-2xl bg-white/8 border border-white/10 overflow-visible">
      {/* رأس المربع */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-extrabold ${slotColors[slotNumber - 1]}`}>
          {slotNumber}
        </span>
        <span className="text-xs font-bold text-white/60">الصنف {slotNames[slotNumber - 1]}</span>
        {selected && (
          <button type="button" onClick={onClear}
            className="mr-auto text-xs text-white/30 hover:text-red-400 transition-colors">
            ✕ مسح
          </button>
        )}
      </div>

      {/* الصنف المختار أو مربع البحث */}
      {selected ? (
        <div className="px-4 pb-4">
          <div className="rounded-xl bg-white/10 px-3 py-3 space-y-0.5">
            <p className="text-sm font-bold text-white">{selected.name}</p>
            <p className="text-xs text-white/50">
              {selected.unit_price.toFixed(2)} ر.س
              {selected.quantity > 1 && ` × ${selected.quantity}`}
              {selected.store && ` · ${selected.store}`}
              {selected.date && ` · ${formatDateShort(selected.date)}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3 relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onFocus={onFocus}
            placeholder="ابحث عن صنف... مثل: حفائظ، أرز، عصير"
            className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/20"
            dir="rtl"
          />

          {/* نتائج البحث */}
          {isActive && results.length > 0 && (
            <div className="absolute right-4 left-4 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-2xl bg-[#1E293B] border border-white/10 shadow-2xl">
              {results.slice(0, 12).map(item => (
                <button
                  key={item.uid}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-white/8 transition-colors border-b border-white/5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-white/40 truncate">
                      {item.store ?? "غير محدد"} · {formatDateShort(item.date)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-bold text-emerald-400 tabular-nums">
                    {item.unit_price.toFixed(2)} ر.س
                  </span>
                </button>
              ))}
              {results.length > 12 && (
                <p className="px-3 py-2 text-xs text-white/30 text-center">وغيرهم {results.length - 12}... دقق البحث أكثر</p>
              )}
            </div>
          )}

          {isActive && search.trim().length > 0 && results.length === 0 && (
            <div className="absolute right-4 left-4 top-full z-20 mt-1 rounded-2xl bg-[#1E293B] border border-white/10 px-4 py-3 text-center shadow-2xl">
              <p className="text-xs text-white/40">ما لقينا "{search}" في مشترياتك</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── نتيجة المقارنة ── */
function CompareResultCard({ result, item1, item2, item3 }: {
  result: CompareResult;
  item1: SelectableItem;
  item2: SelectableItem;
  item3: SelectableItem | null;
}) {
  if (!result.comparable) {
    return (
      <div className="rounded-3xl bg-amber-500/10 border border-amber-500/25 p-5 text-center space-y-3">
        <div className="text-4xl">🤦</div>
        <p className="text-base font-extrabold text-amber-300">المقارنة ما تجي!</p>
        <p className="text-sm text-white/70 leading-relaxed">{result.message}</p>
      </div>
    );
  }

  const slots = [
    { item: item1, price_per_unit: result.item1_price_per_unit, isWinner: result.winner === 1 },
    { item: item2, price_per_unit: result.item2_price_per_unit, isWinner: result.winner === 2 },
    ...(item3 && result.item3_price_per_unit !== null
      ? [{ item: item3, price_per_unit: result.item3_price_per_unit, isWinner: result.winner === 3 }]
      : []),
  ].filter(s => s.price_per_unit !== null);

  /* رتّب من الأرخص للأغلى */
  const sorted = [...slots].sort((a, b) => (a.price_per_unit ?? 0) - (b.price_per_unit ?? 0));

  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-lg">🧙</div>
        <p className="text-sm font-extrabold text-white">نتيجة المقارنة</p>
        {item3 && <span className="mr-auto rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">3 أصناف</span>}
      </div>

      {/* المقارنة المرئية — مرتّبة */}
      {result.unit_label && slots.length > 0 && (
        <div className={`grid gap-3 ${slots.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {sorted.map(({ item, price_per_unit, isWinner }, idx) => (
            <div key={item.uid} className={`rounded-2xl p-3 text-center space-y-1 ${
              isWinner
                ? "bg-emerald-500/20 border border-emerald-500/40 ring-1 ring-emerald-400/30"
                : "bg-white/5 border border-white/10"
            }`}>
              {idx === 0 && <p className="text-[10px] font-bold text-emerald-400">🏆 الأفضل</p>}
              {idx === 1 && slots.length === 3 && <p className="text-[10px] font-bold text-amber-400">🥈 الثاني</p>}
              {idx === slots.length - 1 && slots.length > 1 && !isWinner && (
                <p className="text-[10px] text-white/30">الأغلى</p>
              )}
              <p className="text-xs font-semibold text-white/70 leading-snug" style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>{item.name}</p>
              {item.store && <p className="text-[10px] text-white/40 truncate">{item.store}</p>}
              <p className={`text-xl font-extrabold tabular-nums ${isWinner ? "text-emerald-300" : idx === 1 && slots.length === 3 ? "text-amber-300" : "text-white/60"}`}>
                {price_per_unit!.toFixed(2)}
              </p>
              <p className="text-[10px] text-white/40">ر.س / {result.unit_label}</p>
            </div>
          ))}
        </div>
      )}

      {/* رسالة عمار */}
      <div className="rounded-2xl bg-white/8 px-4 py-3">
        <p className="text-sm leading-relaxed text-white/85 whitespace-pre-line">{result.message}</p>
      </div>

      {/* ملخص التوفير */}
      {result.savings_percent !== null && result.savings_percent > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs">
          <span className="text-white/50">التوفير مقارنةً بالأغلى</span>
          <span className="font-extrabold text-emerald-300">{result.savings_percent.toFixed(0)}% أرخص 💰</span>
        </div>
      )}
    </div>
  );
}

/* ── بطاقة مقارنة المحلات (تاب التحليل) ── */
function CompareCard({ item, expanded, onToggle }: {
  item: CompareItem; expanded: boolean; onToggle: () => void;
}) {
  const cheapestPrice = item.storeStats[0]!.avgPrice;
  const mostExpensivePrice = item.storeStats[item.storeStats.length - 1]!.avgPrice;

  return (
    <div className="rounded-2xl bg-white/8 border border-white/10 overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-right">
        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-xl">⚖️</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{item.name}</p>
          <p className="text-xs text-white/50 mt-0.5">
            <span className="text-emerald-400 font-semibold">{item.cheapestStore}</span>
            {" "}أرخص بـ{" "}
            <span className="font-bold text-amber-300">{item.priceDiff.toFixed(1)} ر.س</span>
            {" "}من {item.mostExpensiveStore}
          </p>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 gap-1">
          {item.potentialSavings > 0.5 && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
              وفّر {item.potentialSavings.toFixed(1)}
            </span>
          )}
          <span className="text-white/30 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-white/40 font-semibold">مقارنة أسعار المحلات:</p>
            {item.storeStats.map((s, idx) => {
              const isMin = idx === 0;
              const barWidth = Math.max(20, (s.avgPrice / mostExpensivePrice) * 100);
              return (
                <div key={s.store} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${isMin ? "text-emerald-300" : "text-white/70"}`}>
                      {isMin ? "⭐ " : ""}{s.store}
                      <span className="text-white/30 font-normal mr-1">({s.count} مرة)</span>
                    </span>
                    <span className={`font-extrabold tabular-nums ${isMin ? "text-emerald-300" : "text-white/80"}`}>
                      {s.avgPrice.toFixed(2)} ر.س
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${isMin ? "bg-emerald-400" : "bg-white/30"}`}
                      style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {item.potentialSavings > 0.1 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
              <p className="text-xs text-emerald-300 font-semibold">
                ✅ لو اشتريت {item.name} دايماً من {item.cheapestStore} توفّر {item.potentialSavings.toFixed(1)} ر.س
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs text-white/40 font-semibold">سجل الشراء:</p>
            {item.allPurchases.slice(0, 6).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-white/50">{p.store ?? "غير محدد"} · {formatDateShort(p.date)}</span>
                <span className={`font-bold tabular-nums ${p.unit_price === item.storeStats[0]!.minPrice ? "text-emerald-400" : "text-white/60"}`}>
                  {p.unit_price.toFixed(2)} ر.س
                  {p.quantity > 1 && <span className="text-white/30 font-normal"> ×{p.quantity}</span>}
                </span>
              </div>
            ))}
            {item.allPurchases.length > 6 && (
              <p className="text-xs text-white/30">+{item.allPurchases.length - 6} مشتريات أخرى</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
            <span className="text-white/40">إجمالي ما صرفته</span>
            <span className="font-extrabold text-white tabular-nums">{item.totalSpent.toFixed(2)} ر.س</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── بطاقة عادة شرائية ── */
function HabitCard({ item }: { item: HabitItem }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 px-4 py-3">
      <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/8 text-lg">🔁</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white/80 truncate">{item.name}</p>
        <p className="text-xs text-white/40 mt-0.5">
          {item.count} مرة
          {item.stores.length > 0 && ` · ${item.stores.slice(0, 2).join("، ")}`}
          {item.lastDate && ` · آخر شراء ${formatDateShort(item.lastDate)}`}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xs font-bold text-white/60 tabular-nums">{item.avgPrice.toFixed(2)}</p>
        <p className="text-[10px] text-white/30">متوسط</p>
      </div>
    </div>
  );
}
