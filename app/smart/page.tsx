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

type PurchaseOccurrence = {
  store: string | null;
  unit_price: number;
  quantity: number;
  date: string | null;
};

type RepeatItemStat = {
  name: string;
  count: number; // عدد المرات
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  cheapestStore: string | null;
  stores: string[]; // متاجر فريدة
  totalSpent: number;
  potentialSavings: number; // لو دايماً من الأرخص
  purchases: PurchaseOccurrence[];
};

/* ──────────────── مساعدات ──────────────── */
function toNumber(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** استخرج قائمة الأصناف المتكررة من بيانات المصاريف */
function analyzeRepeatItems(expenses: ExpenseRow[]): RepeatItemStat[] {
  // نجمع كل شراء لكل صنف
  const map = new Map<string, { displayName: string; purchases: PurchaseOccurrence[] }>();

  for (const exp of expenses) {
    if (Array.isArray(exp.items) && exp.items.length > 0) {
      for (const item of exp.items) {
        if (!item.name?.trim()) continue;
        const key = normalizeName(item.name);
        if (!map.has(key)) map.set(key, { displayName: item.name.trim(), purchases: [] });
        map.get(key)!.purchases.push({
          store: exp.store,
          unit_price: toNumber(item.unit_price),
          quantity: toNumber(item.quantity) || 1,
          date: exp.date,
        });
      }
    }
  }

  const result: RepeatItemStat[] = [];

  for (const [, { displayName, purchases }] of map) {
    if (purchases.length < 2) continue; // متكرر فقط

    const prices = purchases.map((p) => p.unit_price).filter((p) => p > 0);
    if (prices.length === 0) continue;

    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const totalSpent = purchases.reduce((s, p) => s + p.unit_price * p.quantity, 0);
    const potentialSavings = totalSpent - minPrice * purchases.reduce((s, p) => s + p.quantity, 0);

    // أرخص متجر
    let cheapestStore: string | null = null;
    for (const p of purchases) {
      if (p.unit_price === minPrice && p.store) { cheapestStore = p.store; break; }
    }

    // متاجر فريدة
    const storeSet = new Set<string>();
    for (const p of purchases) { if (p.store) storeSet.add(p.store); }

    result.push({
      name: displayName,
      count: purchases.length,
      avgPrice,
      minPrice,
      maxPrice,
      cheapestStore,
      stores: Array.from(storeSet),
      totalSpent,
      potentialSavings: Math.max(0, potentialSavings),
      purchases,
    });
  }

  // ترتيب: الأكثر تكراراً ثم الأعلى توفيراً
  result.sort((a, b) => b.count - a.count || b.potentialSavings - a.potentialSavings);
  return result;
}

/* ──────────────── المكوّن الرئيسي ──────────────── */
export default function SmartPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [repeatItems, setRepeatItems] = useState<RepeatItemStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  /* تحميل البيانات */
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
    setRepeatItems(analyzeRepeatItems(rows));
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  /* إجمالي التوفير المحتمل */
  const totalSavings = repeatItems.reduce((s, i) => s + i.potentialSavings, 0);
  const itemsWithItems = expenses.filter((e) => Array.isArray(e.items) && e.items!.length > 0).length;

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
      const statsPayload = repeatItems.slice(0, 10).map(({ purchases: _p, ...rest }) => rest);
      const res = await fetch(apiUrl("/api/advice"), {
        method: "POST",
        headers,
        body: JSON.stringify({ items: statsPayload }),
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
            {[1,2,3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        </main>
        <BottomNav />
      </AuthGuard>
    );
  }

  /* ── لا توجد بيانات كافية ── */
  if (repeatItems.length === 0) {
    return (
      <AuthGuard>
        <main className="min-h-screen bg-[#0F172A] pb-28 font-sans">
          <SmartHeader />
          <div className="px-4 pt-6 mx-auto max-w-xl">
            <div className="rounded-3xl bg-white/10 p-8 text-center space-y-3">
              <div className="text-5xl">🔍</div>
              <p className="text-lg font-bold text-white">ما لقينا أصناف متكررة</p>
              <p className="text-sm text-white/60">
                {itemsWithItems === 0
                  ? "لمّا تضيف مصاريف بتفاصيل الأصناف، راح يحللها عمار ويوريك فرص التوفير"
                  : `عندك ${expenses.length} مصروف، لكن ما في صنف اشتريته أكثر من مرة بعد`}
              </p>
              {itemsWithItems === 0 && (
                <p className="text-xs text-white/40">
                  📸 ارفع صورة الفاتورة وخلّ الذكاء الاصطناعي يستخرج الأصناف تلقائياً
                </p>
              )}
            </div>
          </div>
        </main>
        <BottomNav />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#0F172A] pb-28 font-sans">
        <SmartHeader />

        <div className="px-4 pt-4 space-y-4 mx-auto max-w-xl">

          {/* ── بطاقة ملخص التوفير ── */}
          {totalSavings > 0.5 && (
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 p-5">
              <p className="text-xs font-bold text-emerald-400 mb-1">💡 فرصة التوفير المحتملة</p>
              <p className="text-3xl font-extrabold text-emerald-300">
                {totalSavings.toFixed(1)}
                <span className="mr-1 text-base font-semibold text-emerald-400/70">ر.س</span>
              </p>
              <p className="text-xs text-white/50 mt-1">
                لو اشتريت دايماً من المتجر الأرخص لكل صنف
              </p>
            </div>
          )}

          {/* ── عمار AI ── */}
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
                عندي {repeatItems.length} صنف متكرر جاهزة للتحليل — اضغط الزر وأنا أوريك وين تقدر توفر
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

          {/* ── قائمة الأصناف المتكررة ── */}
          <div>
            <p className="px-1 mb-3 text-xs font-bold text-white/50">
              {repeatItems.length} صنف اشتريته أكثر من مرة
            </p>
            <div className="space-y-2">
              {repeatItems.map((item) => (
                <RepeatItemCard
                  key={item.name}
                  item={item}
                  expanded={expandedItem === item.name}
                  onToggle={() => setExpandedItem(expandedItem === item.name ? null : item.name)}
                />
              ))}
            </div>
          </div>

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
          <p className="text-xs text-white/50">تحليل عاداتك الشرائية وفرص التوفير</p>
        </div>
      </div>
    </div>
  );
}

/* ── بطاقة صنف متكرر ── */
function RepeatItemCard({
  item,
  expanded,
  onToggle,
}: {
  item: RepeatItemStat;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasPriceDiff = item.maxPrice - item.minPrice > 0.5;

  return (
    <div className="rounded-2xl bg-white/8 border border-white/10 overflow-hidden">
      {/* الصف الرئيسي */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-right"
      >
        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl">
          🛍️
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{item.name}</p>
          <p className="text-xs text-white/50 mt-0.5">
            {item.count} مرة · متوسط {item.avgPrice.toFixed(2)} ر.س
            {item.cheapestStore && (
              <span className="text-emerald-400"> · أرخص: {item.cheapestStore}</span>
            )}
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

      {/* التفاصيل الموسّعة */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-3">

          {/* شريط السعر */}
          {hasPriceDiff && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/50">
                <span>أرخص: {item.minPrice.toFixed(2)} ر.س</span>
                <span>أغلى: {item.maxPrice.toFixed(2)} ر.س</span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="absolute right-0 h-2 rounded-full bg-gradient-to-l from-red-400 to-emerald-400"
                  style={{ width: "100%" }}
                />
                <div
                  className="absolute right-0 h-2 rounded-full bg-gradient-to-l from-emerald-400 to-emerald-500"
                  style={{
                    width: `${Math.max(5, ((item.avgPrice - item.minPrice) / (item.maxPrice - item.minPrice || 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-emerald-400 font-semibold">
                ✅ لو اشتريته دايماً من الأرخص توفّر {item.potentialSavings.toFixed(1)} ر.س
              </p>
            </div>
          )}

          {/* المتاجر */}
          {item.stores.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">المتاجر اللي اشتريت منها:</p>
              <div className="flex flex-wrap gap-1.5">
                {item.stores.map((store) => (
                  <span
                    key={store}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      store === item.cheapestStore
                        ? "bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/40"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {store === item.cheapestStore ? "⭐ " : ""}{store}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* سجل المشتريات */}
          <div>
            <p className="text-xs text-white/40 mb-1.5">سجل الشراء:</p>
            <div className="space-y-1">
              {item.purchases.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-white/50">
                    {p.store ?? "غير محدد"} · {p.date ? new Date(`${p.date}T12:00:00+03:00`).toLocaleDateString("ar-EG-u-nu-latn", { month: "short", day: "numeric", timeZone: "Asia/Riyadh", calendar: "gregory" }) : "-"}
                  </span>
                  <span className={`font-bold ${p.unit_price === item.minPrice ? "text-emerald-400" : "text-white/70"}`}>
                    {p.unit_price.toFixed(2)} ر.س
                    {p.quantity > 1 && <span className="text-white/40"> ×{p.quantity}</span>}
                  </span>
                </div>
              ))}
              {item.purchases.length > 5 && (
                <p className="text-xs text-white/30">+{item.purchases.length - 5} مشتريات أخرى</p>
              )}
            </div>
          </div>

          {/* إجمالي المصروف */}
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
            <span className="text-white/40">إجمالي ما صرفته على هذا الصنف</span>
            <span className="font-extrabold text-white">{item.totalSpent.toFixed(2)} ر.س</span>
          </div>
        </div>
      )}
    </div>
  );
}
