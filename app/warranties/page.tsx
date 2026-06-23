"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import AuthGuard from "../components/auth-guard";
import BottomNav from "../components/bottom-nav";

type Warranty = {
  id: number;
  product_name: string;
  purchase_date: string;
  warranty_months: number;
  warranty_end_date: string;
  store: string | null;
  notes: string | null;
  created_at: string;
};

type FormData = {
  product_name: string;
  purchase_date: string;
  warranty_months: number;
  store: string;
  notes: string;
};

const WARRANTY_PRESETS = [
  { label: "6 أشهر",  months: 6  },
  { label: "سنة",     months: 12 },
  { label: "سنتين",   months: 24 },
  { label: "3 سنوات", months: 36 },
];

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0]!;
}

function daysUntil(dateStr: string): number {
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }) + "T00:00:00");
  const end = new Date(dateStr + "T00:00:00");
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

function StatusBadge({ days }: { days: number }) {
  if (days < 0) return (
    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-400">منتهي</span>
  );
  if (days <= 30) return (
    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">⚠️ ينتهي قريباً</span>
  );
  if (days <= 90) return (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-600">تبقى {days} يوم</span>
  );
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-600">✓ نشط</span>
  );
}

function DaysRing({ days }: { days: number }) {
  const total = Math.max(days, 0);
  const color = days < 0 ? "#d1d5db" : days <= 30 ? "#ef4444" : days <= 90 ? "#f59e0b" : "#1D9E75";
  return (
    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full border-4 flex-shrink-0"
      style={{ borderColor: color }}>
      {days < 0 ? (
        <span className="text-xs font-bold text-gray-400">منتهي</span>
      ) : (
        <>
          <span className="text-lg font-extrabold leading-none" style={{ color }}>{days > 999 ? "∞" : days}</span>
          <span className="text-[9px] text-gray-400">يوم</span>
        </>
      )}
    </div>
  );
}

export default function WarrantiesPage() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

  const [form, setForm] = useState<FormData>({
    product_name: "",
    purchase_date: today,
    warranty_months: 12,
    store: "",
    notes: "",
  });

  useEffect(() => { void loadWarranties(); }, []);

  async function loadWarranties() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("warranties")
      .select("*")
      .eq("user_id", user.id)
      .order("warranty_end_date", { ascending: true });
    setWarranties((data ?? []) as Warranty[]);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.product_name.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("يرجى تسجيل الدخول أولاً"); return; }

    const warranty_end_date = addMonths(form.purchase_date, form.warranty_months);
    const { error } = await supabase.from("warranties").insert({
      user_id: user.id,
      product_name: form.product_name.trim(),
      purchase_date: form.purchase_date,
      warranty_months: form.warranty_months,
      warranty_end_date,
      store: form.store.trim() || null,
      notes: form.notes.trim() || null,
    });

    setSaving(false);
    if (error) {
      // عرض الخطأ الكامل لمساعدة التشخيص
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        setSaveError("جدول الضمانات غير موجود — يرجى تشغيل SQL في Supabase أولاً (راجع التعليمات أسفله)");
      } else {
        setSaveError(`خطأ: ${error.message ?? error.code}`);
      }
    } else {
      setShowAdd(false);
      setSaveError(null);
      setForm({ product_name: "", purchase_date: today, warranty_months: 12, store: "", notes: "" });
      setSuccessMsg("✓ تمت إضافة الضمان");
      setTimeout(() => setSuccessMsg(null), 3000);
      void loadWarranties();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا الضمان؟")) return;
    setDeletingId(id);
    await supabase.from("warranties").delete().eq("id", id);
    setWarranties((prev) => prev.filter((w) => w.id !== id));
    setDeletingId(null);
  }

  /* تقسيم الضمانات */
  const expiringSoon  = warranties.filter((w) => { const d = daysUntil(w.warranty_end_date); return d >= 0 && d <= 30; });
  const active        = warranties.filter((w) => daysUntil(w.warranty_end_date) > 30);
  const expired       = warranties.filter((w) => daysUntil(w.warranty_end_date) < 0);

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 pb-28 font-sans">

        {/* Header */}
        <div className="bg-[#1D9E75] px-5 pt-10 pb-6">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            <div>
              <p className="text-xs font-semibold text-white/70">تتبع ضماناتك</p>
              <h1 className="text-2xl font-extrabold text-white">ضماناتي 🛡️</h1>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-[#1D9E75] shadow-lg transition-opacity active:scale-95"
            >
              <span className="text-lg">+</span>
              إضافة
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {!loading && warranties.length > 0 && (
          <div className="mx-auto max-w-xl px-4 -mt-3">
            <div className="flex gap-3 rounded-2xl bg-white shadow p-3">
              <div className="flex-1 text-center">
                <p className="text-xl font-extrabold text-[#1D9E75]">{active.length}</p>
                <p className="text-[10px] text-gray-400">نشط</p>
              </div>
              <div className="w-px bg-gray-100" />
              <div className="flex-1 text-center">
                <p className="text-xl font-extrabold text-amber-500">{expiringSoon.length}</p>
                <p className="text-[10px] text-gray-400">ينتهي قريباً</p>
              </div>
              <div className="w-px bg-gray-100" />
              <div className="flex-1 text-center">
                <p className="text-xl font-extrabold text-gray-400">{expired.length}</p>
                <p className="text-[10px] text-gray-400">منتهي</p>
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-xl px-4 pt-4 space-y-5">

          {loading && (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          )}

          {!loading && warranties.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-10 text-center shadow">
              <span className="text-5xl">🛡️</span>
              <div>
                <p className="font-bold text-gray-700">لا توجد ضمانات مسجّلة</p>
                <p className="mt-1 text-sm text-gray-400">أضف ضمان منتج عند شرائه وتابع مدته</p>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-2xl bg-[#1D9E75] px-6 py-3 font-bold text-white shadow active:scale-95"
              >
                أضف أول ضمان
              </button>
            </div>
          )}

          {/* ينتهي قريباً */}
          {expiringSoon.length > 0 && (
            <section>
              <p className="mb-2 px-1 text-xs font-bold text-red-500 uppercase tracking-wide">⚠️ ينتهي خلال 30 يوم</p>
              <div className="space-y-3">
                {expiringSoon.map((w) => (
                  <WarrantyCard key={w.id} w={w} onDelete={handleDelete} deletingId={deletingId} urgent />
                ))}
              </div>
            </section>
          )}

          {/* نشط */}
          {active.length > 0 && (
            <section>
              <p className="mb-2 px-1 text-xs font-bold text-gray-400 uppercase tracking-wide">ضمانات نشطة</p>
              <div className="space-y-3">
                {active.map((w) => (
                  <WarrantyCard key={w.id} w={w} onDelete={handleDelete} deletingId={deletingId} />
                ))}
              </div>
            </section>
          )}

          {/* منتهية */}
          {expired.length > 0 && (
            <section>
              <button
                onClick={() => setShowExpired((v) => !v)}
                className="mb-2 flex w-full items-center justify-between px-1"
              >
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  ضمانات منتهية ({expired.length})
                </p>
                <span className="text-gray-400 text-sm">{showExpired ? "▲" : "▼"}</span>
              </button>
              {showExpired && (
                <div className="space-y-3 opacity-60">
                  {expired.map((w) => (
                    <WarrantyCard key={w.id} w={w} onDelete={handleDelete} deletingId={deletingId} />
                  ))}
                </div>
              )}
            </section>
          )}

        </div>

        {/* Toast */}
        {successMsg && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[#1D9E75] px-5 py-3 text-sm font-bold text-white shadow-xl">
            {successMsg}
          </div>
        )}

        {/* Modal إضافة ضمان */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
            <div className="w-full max-w-xl rounded-t-3xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
              {/* محتوى قابل للتمرير */}
              <div className="overflow-y-auto flex-1 p-6 space-y-4 pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-gray-800">إضافة ضمان جديد</h2>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 text-xl leading-none">✕</button>
              </div>

              {/* اسم المنتج */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">اسم المنتج *</label>
                <input
                  type="text"
                  value={form.product_name}
                  onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
                  placeholder="مثال: آيفون 16 برو، ثلاجة سامسونج..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
              </div>

              {/* المتجر */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">المتجر (اختياري)</label>
                <input
                  type="text"
                  value={form.store}
                  onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
                  placeholder="مثال: Jarir، إكسترا، أمازون..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
              </div>

              {/* تاريخ الشراء */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">تاريخ الشراء</label>
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
              </div>

              {/* مدة الضمان */}
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-500">مدة الضمان</label>
                <div className="grid grid-cols-4 gap-2">
                  {WARRANTY_PRESETS.map((p) => (
                    <button
                      key={p.months}
                      onClick={() => setForm((f) => ({ ...f, warranty_months: p.months }))}
                      className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                        form.warranty_months === p.months
                          ? "bg-[#1D9E75] text-white shadow"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={form.warranty_months}
                    onChange={(e) => setForm((f) => ({ ...f, warranty_months: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-20 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-center text-gray-800 outline-none focus:border-[#1D9E75]"
                  />
                  <span className="text-xs text-gray-500">شهر</span>
                  <span className="text-xs text-gray-400">
                    (ينتهي {formatDate(addMonths(form.purchase_date, form.warranty_months))})
                  </span>
                </div>
              </div>

              {/* ملاحظات */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="رقم الفاتورة، رقم السيريال..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
              </div>

              </div>{/* نهاية المحتوى القابل للتمرير */}

              {/* زر الحفظ مثبّت في الأسفل دائماً */}
              <div className="flex-shrink-0 px-6 pt-3 pb-6 border-t border-gray-100 bg-white space-y-3">
                {saveError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                    {saveError}
                  </div>
                )}
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || !form.product_name.trim()}
                  className="w-full rounded-2xl bg-[#1D9E75] py-4 text-base font-extrabold text-white shadow-lg transition-opacity disabled:opacity-50 active:scale-[0.98]"
                >
                  {saving ? "جاري الحفظ..." : "حفظ الضمان 🛡️"}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
      <BottomNav />
    </AuthGuard>
  );
}

/* ── بطاقة ضمان ── */
function WarrantyCard({
  w, onDelete, deletingId, urgent,
}: {
  w: Warranty;
  onDelete: (id: number) => Promise<void>;
  deletingId: number | null;
  urgent?: boolean;
}) {
  const days = daysUntil(w.warranty_end_date);
  return (
    <div className={`flex items-center gap-4 rounded-2xl bg-white px-4 py-4 shadow ${urgent ? "ring-2 ring-red-200" : ""}`}>
      <DaysRing days={days} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 truncate">{w.product_name}</p>
        {w.store && <p className="text-xs text-gray-400 mt-0.5">📍 {w.store}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <StatusBadge days={days} />
          <span className="text-[10px] text-gray-400">
            ينتهي {formatDate(w.warranty_end_date)}
          </span>
        </div>
        {w.notes && (
          <p className="text-[10px] text-gray-400 mt-1 truncate">📝 {w.notes}</p>
        )}
      </div>
      <button
        onClick={() => void onDelete(w.id)}
        disabled={deletingId === w.id}
        className="flex-shrink-0 rounded-xl p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
      >
        {deletingId === w.id ? "⏳" : "🗑"}
      </button>
    </div>
  );
}
