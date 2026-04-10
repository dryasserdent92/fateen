"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { apiUrl } from "../../lib/api-client";

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

type MonthItem      = { ym: string; label: string; count: number };
type CatItem        = { cat: string; count: number; amount: number };
type SpenderRow     = { name: string; avatar: string | null; total: number; count: number };
type SuspiciousRow  = { userId: string; userName: string; amount: number; date: string | null; category: string };

type Stats = {
  summary: {
    totalUsers: number;
    newThisMonth: number;
    newLastMonth: number;
    activeThisMonth: number;
    totalExpenses: number;
    totalAmount: number;
    orphanedCount: number;
    orphanedTotal: number;
  };
  monthlyGrowth:       MonthItem[];
  topCategories:       CatItem[];
  engagementBuckets:   Record<string, number>;
  topSpenders:         SpenderRow[];
  suspiciousExpenses:  SuspiciousRow[];
  users:               UserRow[];
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
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  /* ── كلمة المرور ── */
  const [password, setPassword]   = useState("");
  const [unlocked, setUnlocked]   = useState(false);
  const [pwError, setPwError]     = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setPwError(false);
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    const res = await fetch(apiUrl("/api/admin/stats"), {
      headers: {
        "Authorization":    `Bearer ${session.access_token}`,
        "x-admin-password": password,
      },
    });
    if (res.ok) {
      const data = await res.json() as Stats;
      setStats(data);
      setUnlocked(true);
    } else {
      setPwError(true);
      setPassword("");
    }
    setLoading(false);
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(`هل تريد حذف المستخدم "${userName}" وكل مصاريفه نهائياً؟ لا يمكن التراجع.`)) return;
    setDeletingUser(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl(`/api/admin/delete-user?userId=${userId}`), {
        method: "DELETE",
        headers: {
          "Authorization":    `Bearer ${session!.access_token}`,
          "x-admin-password": password,
        },
      });
      if (res.ok) {
        setStats((prev) => prev
          ? { ...prev, users: prev.users.filter((u) => u.id !== userId) }
          : prev);
        setExpandedUser(null);
      } else {
        const j = await res.json() as { error?: string };
        alert(j.error ?? "فشل الحذف");
      }
    } catch { alert("حدث خطأ"); }
    finally { setDeletingUser(null); }
  }

  async function load() {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    const res = await fetch(apiUrl("/api/admin/stats"), {
      headers: {
        "Authorization":    `Bearer ${session.access_token}`,
        "x-admin-password": password,
      },
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

  /* ─── Password screen ─── */
  if (!unlocked) return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6">
      <form onSubmit={(e) => void handleUnlock(e)}
        className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[#1D9E75]/10 text-3xl">
            🔐
          </div>
          <h1 className="text-xl font-extrabold text-gray-800">لوحة تحكم فطين</h1>
          <p className="mt-1 text-sm text-gray-400">أدخل كلمة مرور الأدمن للمتابعة</p>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPwError(false); }}
            placeholder="كلمة المرور"
            autoFocus
            className={`w-full rounded-2xl border px-4 py-3 text-center text-lg font-bold tracking-widest outline-none transition-colors focus:ring-2 focus:ring-[#1D9E75] ${
              pwError ? "border-red-300 bg-red-50 text-red-600" : "border-gray-200 text-gray-800"
            }`}
          />
          {pwError && (
            <p className="text-center text-sm font-semibold text-red-500">
              ❌ كلمة المرور غير صحيحة
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-2xl bg-[#1D9E75] py-3.5 text-base font-bold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "⏳ جاري التحقق..." : "دخول →"}
        </button>

        <button type="button" onClick={() => router.push("/")}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-600">
          ← العودة للرئيسية
        </button>
      </form>
    </main>
  );

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
              { label: "مجموع المبالغ",      value: `${summary.totalAmount.toLocaleString("ar-SA-u-nu-latn")} ر.س`, icon: "💰", sub: "مجموع مصروفات كل المستخدمين", raw: true },
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

        {/* ── رسوم إضافية ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* أكثر التصنيفات */}
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-gray-700">🏷️ أكثر التصنيفات استخداماً</h2>
            <div className="space-y-2.5">
              {(stats!.topCategories.slice(0, 6)).map(({ cat, count, amount }) => {
                const maxCount = stats!.topCategories[0]?.count ?? 1;
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">
                        {CATEGORY_ICONS[cat] ?? "💳"} {cat}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{count}×</span>
                        <span className="text-xs font-bold text-[#1D9E75]">{amount} ر.س</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-[#1D9E75] transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* توزيع التفاعل */}
          <div className="rounded-3xl bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-700">📊 توزيع المستخدمين حسب النشاط</h2>
            <div className="space-y-3">
              {Object.entries(stats!.engagementBuckets).map(([bucket, count]) => {
                const total = stats!.summary.totalUsers || 1;
                const pct   = Math.round((count / total) * 100);
                const labels: Record<string, string> = {
                  "0": "لم يبدأ بعد", "1-5": "مبتدئ (1-5)", "6-20": "نشط (6-20)", "21+": "متحمس (21+)",
                };
                const colors: Record<string, string> = {
                  "0": "bg-gray-200", "1-5": "bg-blue-300", "6-20": "bg-[#1D9E75]/60", "21+": "bg-[#1D9E75]",
                };
                return (
                  <div key={bucket}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">{labels[bucket]}</span>
                      <span className="text-xs text-gray-400">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100">
                      <div className={`h-2.5 rounded-full ${colors[bucket]} transition-all`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* أعلى المنفقين */}
            {stats!.topSpenders.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="mb-3 text-xs font-bold text-gray-500">💰 أعلى المنفقين</p>
                <div className="space-y-2">
                  {stats!.topSpenders.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                        i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : "bg-orange-300"
                      }`}>{i + 1}</span>
                      {s.avatar
                        ? <img src={s.avatar} className="size-6 rounded-full object-cover shrink-0" />
                        : <div className="size-6 rounded-full bg-[#1D9E75]/15 flex items-center justify-center text-xs shrink-0">👤</div>
                      }
                      <p className="flex-1 text-xs font-semibold text-gray-700 truncate">{s.name}</p>
                      <p className="text-xs font-bold text-[#1D9E75] shrink-0">{s.total} ر.س</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ⚠️ مصاريف مشبوهة */}
        {stats!.suspiciousExpenses.length > 0 && (
          <div className="rounded-3xl bg-orange-50 border border-orange-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⚠️</span>
              <h2 className="text-sm font-bold text-orange-700">
                مصاريف مشبوهة — مبالغ تتجاوز 10,000 ر.س ({stats!.suspiciousExpenses.length})
              </h2>
            </div>
            <div className="space-y-2">
              {stats!.suspiciousExpenses.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{s.userName}</p>
                    <p className="text-xs text-gray-400">{s.category} · {s.date ?? "—"}</p>
                  </div>
                  <span className="text-base font-extrabold text-orange-500">
                    {s.amount.toLocaleString("ar-SA-u-nu-latn")} ر.س
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-orange-500">
              💡 هذه المصاريف قد تكون بيانات فاسدة — احذفها من Supabase إذا كانت خاطئة. المصاريف الجديدة محدودة بـ 99,999 ر.س.
            </p>
          </div>
        )}

        {/* 🔴 مصاريف يتيمة */}
        {stats!.summary.orphanedCount > 0 && (
          <div className="rounded-3xl bg-red-50 border border-red-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔴</span>
              <h2 className="text-sm font-bold text-red-700">
                مصاريف يتيمة — غير مرتبطة بأي مستخدم ({stats!.summary.orphanedCount} مصروف)
              </h2>
            </div>
            <p className="text-sm text-red-600 mb-3">
              مجموعها <span className="font-extrabold">{stats!.summary.orphanedTotal.toLocaleString("ar-SA-u-nu-latn")} ر.س</span> — هذا هو سبب الفرق بين المجموع الكلي القديم والمبالغ الحالية.
            </p>
            <div className="rounded-2xl bg-white px-4 py-3 border border-red-100">
              <p className="text-xs font-bold text-gray-500 mb-1">🧹 لحذفها نهائياً من Supabase SQL Editor:</p>
              <code className="text-xs text-red-600 font-mono break-all">
                DELETE FROM expenses WHERE user_id NOT IN (SELECT id FROM auth.users);
              </code>
            </div>
          </div>
        )}

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

          {/* شريط المجموع */}
          {filteredUsers.length > 0 && (() => {
            const shownTotal  = filteredUsers.reduce((s, u) => s + u.expenseTotal, 0);
            const shownCount  = filteredUsers.reduce((s, u) => s + u.expenseCount, 0);
            const grandTotal  = stats!.summary.totalAmount;
            const isFullMatch = filteredUsers.length === (stats?.users.length ?? 0);
            return (
              <div className="flex items-center justify-between gap-3 px-5 py-3 bg-[#1D9E75]/8 border-b border-[#1D9E75]/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">
                    {isFullMatch ? "∑ مجموع كل المستخدمين" : `∑ مجموع المعروضين (${filteredUsers.length})`}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                    {shownCount} مصروف
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-extrabold ${isFullMatch && Math.round(shownTotal) === grandTotal ? "text-[#1D9E75]" : "text-orange-500"}`}>
                    {Math.round(shownTotal).toLocaleString("ar-SA-u-nu-latn")} ر.س
                  </span>
                  {isFullMatch && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Math.round(shownTotal) === grandTotal ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-500"}`}>
                      {Math.round(shownTotal) === grandTotal ? "✓ يطابق المجموع الكلي" : `≠ الكلي: ${grandTotal.toLocaleString("ar-SA-u-nu-latn")} ر.س`}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

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

                      {/* زر الحذف */}
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(u.id, u.name)}
                          disabled={deletingUser === u.id}
                          className="w-full rounded-2xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-500 transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          {deletingUser === u.id ? "⏳ جاري الحذف..." : "🗑 حذف هذا المستخدم وكل مصاريفه"}
                        </button>
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
