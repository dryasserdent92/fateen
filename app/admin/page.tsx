"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

/* ─── Types ─── */
type UserRow = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  provider: string;
  joinedAt: string;
  lastSignIn: string | null;
  expenseCount: number;
  expenseTotal: number;
  lastExpDate: string | null;
  topCategory: string | null;
  isActive: boolean;
};

type MonthItem = { ym: string; label: string; count: number };

type Stats = {
  summary: {
    totalUsers: number;
    newThisMonth: number;
    newLastMonth: number;
    activeThisMonth: number;
    totalExpenses: number;
    totalAmount: number;
  };
  monthlyGrowth: MonthItem[];
  users: UserRow[];
};

/* ─── Helpers ─── */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric", month: "short", day: "numeric",
    calendar: "gregory", timeZone: "Asia/Riyadh",
  });
}

const CATEGORY_ICONS: Record<string, string> = {
  مطاعم:"🍽️", قهوة:"☕", بنزين:"⛽", سوبرماركت:"🛒",
  تسوق:"🛍️", صحة:"🏥", فواتير:"💡", أخرى:"💳",
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google", email: "إيميل", github: "GitHub",
};

/* ─── Component ─── */
export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    const res = await fetch("/api/admin/stats", {
      headers: { "Authorization": `Bearer ${session.access_token}` },
    });
    if (res.status === 403) { setError("ليس لديك صلاحية الوصول"); setLoading(false); return; }
    if (!res.ok)             { setError("حدث خطأ في تحميل البيانات"); setLoading(false); return; }
    const data = await res.json() as Stats;
    setStats(data);
    setLoading(false);
  }

  const filteredUsers = (stats?.users ?? []).filter((u) => {
    const matchSearch = !search || u.name.includes(search) || u.email.includes(search);
    const matchFilter = filterActive === "all" || (filterActive === "active" ? u.isActive : !u.isActive);
    return matchSearch && matchFilter;
  });

  const maxGrowth = Math.max(...(stats?.monthlyGrowth.map((m) => m.count) ?? [1]), 1);

  /* ─── Loading ─── */
  if (loading) return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75]">
      <div className="flex flex-col items-center gap-4">
        <span className="size-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
        <p className="text-sm font-semibold text-white/80">تحميل البيانات...</p>
      </div>
    </main>
  );

  /* ─── Error ─── */
  if (error) return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6">
      <div className="rounded-3xl bg-white p-8 text-center shadow-lg max-w-sm">
        <p className="text-4xl">🔒</p>
        <p className="mt-4 text-lg font-bold text-gray-800">{error}</p>
        <button onClick={() => router.push("/")}
          className="mt-4 rounded-xl bg-[#1D9E75] px-6 py-2 text-sm font-bold text-white">
          العودة
        </button>
      </div>
    </main>
  );

  const { summary, monthlyGrowth, users } = stats!;
  const activeRate = summary.totalUsers > 0
    ? Math.round((summary.activeThisMonth / summary.totalUsers) * 100) : 0;

  return (
    <main className="min-h-screen bg-gray-50 font-sans" dir="rtl">

      {/* Header */}
      <div className="bg-[#1D9E75] px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">لوحة تحكم</p>
              <h1 className="text-3xl font-extrabold text-white">📊 فطين — الإدارة</h1>
            </div>
            <button onClick={() => router.push("/")}
              className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30">
              ← الرئيسية
            </button>
          </div>

          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "إجمالي المستخدمين", value: summary.totalUsers, icon: "👥", sub: null },
              { label: "جدد هذا الشهر",     value: summary.newThisMonth, icon: "🆕",
                sub: summary.newLastMonth > 0
                  ? `${summary.newLastMonth > summary.newThisMonth ? "▼" : "▲"} ${Math.abs(summary.newThisMonth - summary.newLastMonth)} عن الشهر الماضي`
                  : null },
              { label: "نشطون هذا الشهر",  value: summary.activeThisMonth, icon: "🟢", sub: `${activeRate}% من الكل` },
              { label: "إجمالي المصاريف",   value: summary.totalExpenses,   icon: "🧾", sub: "عملية مسجّلة" },
              { label: "مجموع المبالغ",      value: `${summary.totalAmount.toFixed(0)} ر.س`, icon: "💰", sub: "عبر كل الحسابات", raw: true },
              { label: "المزود",              value: "Google", icon: "🔗", sub: "100% مستخدمين", raw: true },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span>{c.icon}</span>
                  <p className="text-xs font-medium text-white/70">{c.label}</p>
                </div>
                <p className="text-2xl font-extrabold text-white">
                  {"raw" in c ? c.value : c.value}
                </p>
                {c.sub && <p className="mt-0.5 text-xs text-white/60">{c.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">

        {/* نمو المستخدمين */}
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-bold text-gray-700">📈 نمو المستخدمين — آخر 6 أشهر</h2>
          <div className="flex items-end justify-between gap-2 h-28">
            {monthlyGrowth.map((m) => {
              const pct = maxGrowth > 0 ? (m.count / maxGrowth) * 100 : 0;
              return (
                <div key={m.ym} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-bold text-[#1D9E75]">
                    {m.count > 0 ? m.count : ""}
                  </span>
                  <div className="flex w-full items-end justify-center" style={{ height: "72px" }}>
                    <div
                      className="w-full rounded-t-xl bg-[#1D9E75]/20 transition-all hover:bg-[#1D9E75]/50"
                      style={{ height: `${Math.max(pct, m.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{m.label.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* فلتر وبحث */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="🔍 بحث بالاسم أو الإيميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
          />
          <div className="flex rounded-2xl bg-white border border-gray-200 overflow-hidden">
            {(["all","active","inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilterActive(f)}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors ${
                  filterActive === f ? "bg-[#1D9E75] text-white" : "text-gray-500 hover:bg-gray-50"
                }`}>
                {f === "all" ? `الكل (${users.length})` : f === "active" ? `نشطون (${users.filter(u=>u.isActive).length})` : `غير نشطين (${users.filter(u=>!u.isActive).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* جدول المستخدمين */}
        <div className="rounded-3xl bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-700">
              👤 المستخدمون ({filteredUsers.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredUsers.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-gray-400">لا توجد نتائج</p>
            )}
            {filteredUsers.map((u) => {
              const isExpanded = expandedUser === u.id;
              return (
                <div key={u.id}>
                  {/* الصف الرئيسي */}
                  <button
                    type="button"
                    onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-right"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="size-10 rounded-full object-cover" />
                      ) : (
                        <div className="size-10 rounded-full bg-[#1D9E75]/15 flex items-center justify-center text-lg">
                          👤
                        </div>
                      )}
                    </div>

                    {/* الاسم والإيميل */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-800 truncate">{u.name}</p>
                        {u.isActive && (
                          <span className="flex-shrink-0 size-2 rounded-full bg-green-400" title="نشط هذا الشهر" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>

                    {/* الإحصاء السريع */}
                    <div className="flex-shrink-0 text-left space-y-0.5">
                      <p className="text-xs font-bold text-[#1D9E75]">{u.expenseCount} مصروف</p>
                      <p className="text-xs text-gray-400">{u.expenseTotal.toFixed(0)} ر.س</p>
                    </div>

                    <span className={`flex-shrink-0 text-xs text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {/* التفاصيل الموسّعة */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs text-gray-400">تاريخ الانضمام</p>
                          <p className="text-sm font-bold text-gray-700">{formatDate(u.joinedAt)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs text-gray-400">آخر تسجيل دخول</p>
                          <p className="text-sm font-bold text-gray-700">{formatDate(u.lastSignIn)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs text-gray-400">آخر مصروف</p>
                          <p className="text-sm font-bold text-gray-700">{formatDate(u.lastExpDate)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs text-gray-400">طريقة التسجيل</p>
                          <p className="text-sm font-bold text-gray-700">
                            {u.provider === "google" ? "🔵 Google" : PROVIDER_LABELS[u.provider] ?? u.provider}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs text-gray-400">التصنيف الأكثر</p>
                          <p className="text-sm font-bold text-gray-700">
                            {u.topCategory ? `${CATEGORY_ICONS[u.topCategory] ?? "💳"} ${u.topCategory}` : "—"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs text-gray-400">الحالة</p>
                          <p className={`text-sm font-bold ${u.isActive ? "text-green-600" : "text-gray-400"}`}>
                            {u.isActive ? "🟢 نشط هذا الشهر" : u.expenseCount > 0 ? "🟡 غير نشط" : "⚪ لم يبدأ بعد"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          البيانات محدّثة في الوقت الفعلي · فطين Admin
        </p>
      </div>
    </main>
  );
}
