"use client";

import { useEffect, useState, useCallback } from "react";
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

/** صنف فيه مقارنة حقيقية بين محلات بأسعار مختلفة */
type CompareItem = {
  name: string;
  storeStats: {
    store: string;
    avgPrice: number;
    minPrice: number;
    count: number;
  }[];
  cheapestStore: string;
  mostExpensiveStore: string;
  priceDiff: number;          // الفرق بين الأرخص والأغلى
  totalSpent: number;
  potentialSavings: number;
  allPurchases: Purchase[];
};

/** صنف متكرر بدون مقارنة (نفس المحل أو نفس السعر) */
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

/**
 * التحليل الرئيسي:
 * 1. جمع كل الأصناف
 * 2. إزالة التكرار: نفس اليوم + نفس السعر = إدخال واحد فقط
 * 3. تقسيم الأصناف:
 *    - CompareItem: محلات مختلفة + أسعار مختلفة (فرق > 0.5 ريال)
 *    - HabitItem: متكرر لكن بدون فرق حقيقي
 */
function analyzeExpenses(expenses: ExpenseRow[]): AnalysisResult {
  const map = new Map<string, { displayName: string; purchases: Purchase[] }>();

  /* ── جمع كل الأصناف ── */
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

    /* ── إزالة التكرار: نفس التاريخ + نفس السعر ── */
    const seen = new Set<string>();
    const deduped: Purchase[] = [];
    for (const p of purchases) {
      const dedupKey = `${p.date ?? ""}__${p.unit_price.toFixed(2)}`;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        deduped.push(p);
      }
    }
    if (deduped.length < 2) continue;

    /* ── حساب متاجر فريدة وأسعار فريدة ── */
    const uniqueStores = new Set(deduped.map(p => p.store ?? "").filter(Boolean));
    const uniquePrices = new Set(deduped.map(p => Math.round(p.unit_price * 100)));
    const hasMultipleStores = uniqueStores.size >= 2;
    const hasMultiplePrices = uniquePrices.size >= 2;

    const prices = deduped.map(p => p.unit_price).filter(p => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const priceDiff = maxPrice - minPrice;
    const totalSpent = deduped.reduce((s, p) => s + p.unit_price * p.quantity, 0);
    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const lastDate = deduped.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0]?.date ?? null;

    /* ── شرط المقارنة الحقيقية: محلات مختلفة + فرق سعر > 0.5 ريال ── */
    if (hasMultipleStores && hasMultiplePrices && priceDiff > 0.5) {
      /* احسب متوسط السعر لكل محل */
      const storeMap = new Map<string, number[]>();
      for (const p of deduped) {
        if (!p.store || p.unit_price <= 0) continue;
        if (!storeMap.has(p.store)) storeMap.set(p.store, []);
        storeMap.get(p.store)!.push(p.unit_price);
      }

      const storeStats = Array.from(storeMap.entries()).map(([store, storePrices]) => ({
        store,
        avgPrice: storePrices.reduce((a, b) => a + b, 0) / storePrices.length,
        minPrice: Math.min(...storePrices),
        count: storePrices.length,
      })).sort((a, b) => a.avgPrice - b.avgPrice);

      if (storeStats.length < 2) {
        // لو بعد الحساب محل واحد فقط، روّح لـ habit
        habitItems.push({ name: displayName, count: deduped.length, avgPrice, totalSpent, stores: Array.from(uniqueStores), lastDate });
        continue;
      }

      const cheapestStore = storeStats[0]!.store;
      const mostExpensiveStore = storeStats[storeStats.length - 1]!.store;
      const cheapestAvg = storeStats[0]!.avgPrice;
      const potentialSavings = deduped.reduce((s, p) => {
        if (p.unit_price > 0) return s + (p.unit_price - cheapestAvg) * p.quantity;
        return s;
      }, 0);

      compareItems.push({
        name: displayName,
        storeStats,
        cheapestStore,
        mostExpensiveStore,
        priceDiff,
        totalSpent,
        potentialSavings: Math.max(0, potentialSavings),
        allPurchases: deduped,
      });
    } else {
      /* عادة شرائية بدون مقارنة */
      habitItems.push({
        name: displayName,
        count: deduped.length,
        avgPrice,
        totalSpent,
        stores: Array.from(uniqueStores),
        lastDate,
      });
    }
  }

  /* ترتيب: الأعلى توفيراً أولاً */
  compareItems.sort((a, b) => b.potentialSavings - a.potentialSavings || b.priceDiff - a.priceDiff);
  habitItems.sort((a, b) => b.count - a.count);

  const totalSavings = compareItems.reduce((s, i) => s + i.potentialSavings, 0);
  return { compareItems, habitItems, totalSavings };
}

/* ──────────────── المكوّن الرئيسي ──────────────── */
export default function SmartPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult>({ compareItems: [], habitItems: [], totalSavings: 0 });
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [expandedCompare, setExpandedCompare] = useState<string | null>(null);
  const [showAllHabits, setShowAllHabits] = useState(false);

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
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const { compareItems, habitItems, totalSavings } = analysis;
  const itemsWithItems = expenses.filter(e => Array.isArray(e.items) && e.items!.length > 0).length;

  /* طلب نصيحة عمار */
  async function askAmmar() {
    if (loadingAdvice) return;
    setLoadingAdvice(true);
    setAdviceError(null);
    setAdvice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };
      const payload = compareItems.slice(0, 8).map(item => ({
        name: item.name,
        storeStats: item.storeStats,
        cheapestStore: item.cheapestStore,
        priceDiff: item.priceDiff,
        potentialSavings: item.potentialSavings,
        count: item.allPurchases.length,
        totalSpent: item.totalSpent,
      }));
      const res = await fetch(apiUrl("/api/advice"), {
        method: "POST",
        headers,
        body: JSON.stringify({ items: payload }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "فشل الطلب");
      }
      const json = (await res.json()) as { advice?: string };
      setAdvice(json.advice ?? "ما رد عمار، جرب ثانياً.");
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : "فشل الاتصال");
    } finally {
      setLoadingAdvice(false);
    }
  }

  /* ── Skeleton ── */
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

  /* ── لا توجد بيانات كافية ── */
  if (compareItems.length === 0 && habitItems.length === 0) {
    return (
      <AuthGuard>
        <main className="min-h-screen bg-[#0F172A] pb-28 font-sans">
          <SmartHeader />
          <div className="px-4 pt-6 mx-auto max-w-xl">
            <div className="rounded-3xl bg-white/10 p-8 text-center space-y-3">
              <div className="text-5xl">🔍</div>
              <p className="text-lg font-bold text-white">
                {itemsWithItems === 0 ? "ما فيه أصناف بعد" : "ما فيه أصناف متكررة بعد"}
              </p>
              <p className="text-sm text-white/60">
                {itemsWithItems === 0
                  ? "لمّا تضيف مصاريف بتفاصيل الأصناف، راح يحللها عمار ويوريك فرص التوفير"
                  : "كل صنف اشتريته مرة واحدة فقط حتى الآن"}
              </p>
              {itemsWithItems === 0 && (
                <p className="text-xs text-white/40">📸 ارفع صورة الفاتورة وخلّ الذكاء الاصطناعي يستخرج الأصناف</p>
              )}
            </div>
          </div>
        </main>
        <BottomNav />
      </AuthGuard>
    );
  }

  const habitsToShow = showAllHabits ? habitItems : habitItems.slice(0, 4);

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#0F172A] pb-28 font-sans">
        <SmartHeader />

        <div className="px-4 pt-4 space-y-5 mx-auto max-w-xl">

          {/* ── بطاقة ملخص التوفير ── */}
          {totalSavings > 0.5 && (
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 p-5">
              <p className="text-xs font-bold text-emerald-400 mb-1">💡 فرصة التوفير المحتملة</p>
              <p className="text-3xl font-extrabold text-emerald-300">
                {totalSavings.toFixed(1)}
                <span className="mr-1 text-base font-semibold text-emerald-400/70">ر.س</span>
              </p>
              <p className="text-xs text-white/50 mt-1">
                لو اشتريت دايماً من المتجر الأرخص — بناءً على {compareItems.length} صنف شريته من محلات مختلفة بأسعار مختلفة
              </p>
            </div>
          )}

          {/* ── عمار AI — يظهر فقط لو فيه مقارنات ── */}
          {compareItems.length > 0 && (
            <div className="rounded-3xl bg-white/8 border border-white/10 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl shadow-lg">
                  🧙
                </div>
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
                <p className="text-xs text-white/50">
                  عندي {compareItems.length} صنف اشتريته من محلات بأسعار مختلفة — اضغط وعمار يوريك وين الفرصة الأفضل
                </p>
              )}

              <button
                type="button"
                onClick={() => void askAmmar()}
                disabled={loadingAdvice}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/40 transition-opacity hover:opacity-90 disabled:opacity-60 active:scale-[0.98]"
              >
                {loadingAdvice ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    عمار يحلل...
                  </span>
                ) : advice ? "🔄 طلب نصيحة جديدة" : "🔮 اطلب نصيحة عمار"}
              </button>
            </div>
          )}

          {/* ── مقارنة المحلات ── */}
          {compareItems.length > 0 && (
            <section className="space-y-2">
              <p className="px-1 text-xs font-bold text-white/50 uppercase tracking-wider">
                ⚖️ مقارنة المحلات ({compareItems.length})
              </p>
              {compareItems.map(item => (
                <CompareCard
                  key={item.name}
                  item={item}
                  expanded={expandedCompare === item.name}
                  onToggle={() => setExpandedCompare(expandedCompare === item.name ? null : item.name)}
                />
              ))}
            </section>
          )}

          {/* ── عادات الشراء ── */}
          {habitItems.length > 0 && (
            <section className="space-y-2">
              <p className="px-1 text-xs font-bold text-white/50 uppercase tracking-wider">
                🔁 عاداتك الشرائية ({habitItems.length})
              </p>
              <p className="px-1 text-xs text-white/30">أصناف تشتريها بانتظام — ما في فرق سعر كافٍ بين المحلات</p>
              <div className="space-y-1.5">
                {habitsToShow.map(item => (
                  <HabitCard key={item.name} item={item} />
                ))}
              </div>
              {habitItems.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllHabits(v => !v)}
                  className="w-full rounded-2xl bg-white/5 py-3 text-xs font-semibold text-white/50 hover:bg-white/10 transition-colors"
                >
                  {showAllHabits ? "▲ عرض أقل" : `▼ عرض الكل (${habitItems.length})`}
                </button>
              )}
            </section>
          )}

        </div>
      </main>
      <BottomNav />
    </AuthGuard>
  );
}

/* ── Header ── */
function SmartHeader() {
  return (
    <div className="px-5 pt-10 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl shadow-lg">
          🧠
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">خلك فطين</h1>
          <p className="text-xs text-white/50">مقارنة أسعار المحلات وعاداتك الشرائية</p>
        </div>
      </div>
    </div>
  );
}

/* ── بطاقة مقارنة المحلات ── */
function CompareCard({ item, expanded, onToggle }: {
  item: CompareItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cheapestPrice = item.storeStats[0]!.avgPrice;
  const mostExpensivePrice = item.storeStats[item.storeStats.length - 1]!.avgPrice;

  return (
    <div className="rounded-2xl bg-white/8 border border-white/10 overflow-hidden">
      {/* الصف الرئيسي */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-right"
      >
        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-xl">
          ⚖️
        </div>
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

      {/* التفاصيل */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-4 space-y-4">

          {/* مقارنة المحلات */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 font-semibold">مقارنة أسعار المحلات:</p>
            {item.storeStats.map((s, idx) => {
              const isMin = idx === 0;
              const barWidth = cheapestPrice > 0
                ? Math.max(20, (s.avgPrice / mostExpensivePrice) * 100)
                : 50;
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
                    <div
                      className={`h-1.5 rounded-full ${isMin ? "bg-emerald-400" : "bg-white/30"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* توصية التوفير */}
          {item.potentialSavings > 0.1 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
              <p className="text-xs text-emerald-300 font-semibold">
                ✅ لو اشتريت {item.name} دايماً من {item.cheapestStore} توفّر {item.potentialSavings.toFixed(1)} ر.س
              </p>
            </div>
          )}

          {/* سجل الشراء */}
          <div className="space-y-1.5">
            <p className="text-xs text-white/40 font-semibold">سجل الشراء:</p>
            {item.allPurchases.slice(0, 6).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-white/50">
                  {p.store ?? "غير محدد"} · {formatDateShort(p.date)}
                </span>
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

          {/* إجمالي */}
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
            <span className="text-white/40">إجمالي ما صرفته على هذا الصنف</span>
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
      <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/8 text-lg">
        🔁
      </div>
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
