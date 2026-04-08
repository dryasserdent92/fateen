"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "../components/auth-guard";

const CATEGORIES = ["مطاعم", "قهوة", "بنزين", "سوبرماركت", "تسوق", "أخرى"] as const;
type Category = (typeof CATEGORIES)[number];

type ExtractedExpense = {
  store: string;
  amount: string;
  date: string;
  category: Category;
};

type Step = "upload" | "review" | "saved";

const STEPS: Step[] = ["upload", "review", "saved"];
const STEP_LABELS = ["رفع", "مراجعة", "حفظ"];

export default function AddExpensePage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expense, setExpense] = useState<ExtractedExpense>({
    store: "",
    amount: "",
    date: new Date().toISOString().split("T")[0]!,
    category: "أخرى",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Step 1: Analyse only, no save ── */
  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!file) { setError("ارفع صورة فاتورة أولاً"); return; }
    setError(null);
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = (await res.json()) as {
        expense?: Partial<ExtractedExpense & { amount: number }>;
        mergedExpense?: Partial<ExtractedExpense & { amount: number }>;
        expenses?: Partial<ExtractedExpense & { amount: number }>[];
        error?: string;
      };
      if (!res.ok) { setError(data.error ?? "فشل التحليل"); return; }
      const extracted = data.expense ?? data.mergedExpense ?? (data.expenses?.[0]);
      if (extracted) {
        const amt = (extracted as { amount?: number | string }).amount;
        setExpense({
          store: (extracted as { store?: string }).store ?? "",
          amount: amt != null ? String(amt) : "",
          date: (extracted as { date?: string }).date ?? new Date().toISOString().split("T")[0]!,
          category: ((extracted as { category?: string }).category as Category) ?? "أخرى",
        });
      }
      setStep("review");
    } catch {
      setError("حدث خطأ، حاول مجدداً");
    } finally {
      setAnalyzing(false);
    }
  }

  /* ── Step 2: Save after review ── */
  async function handleSave() {
    if (!expense.amount || isNaN(parseFloat(expense.amount))) {
      setError("أدخل مبلغاً صحيحاً");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: expense.store || null,
          amount: parseFloat(expense.amount),
          date: expense.date,
          category: expense.category,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "فشل الحفظ"); return; }
      setStep("saved");
    } catch {
      setError("حدث خطأ، حاول مجدداً");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setError(null);
    setExpense({
      store: "",
      amount: "",
      date: new Date().toISOString().split("T")[0]!,
      category: "أخرى",
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <AuthGuard>
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6 py-10 font-sans">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg sm:p-8">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          {step !== "saved" && (
            <Link href="/" className="text-2xl leading-none text-[#1D9E75] hover:opacity-70">
              ←
            </Link>
          )}
          <h1 className="text-2xl font-extrabold text-[#1D9E75]">
            {step === "upload" && "رفع فاتورة"}
            {step === "review" && "مراجعة البيانات"}
            {step === "saved" && "تم الحفظ ✓"}
          </h1>
        </div>

        {/* Progress steps */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i < currentStepIndex
                      ? "bg-[#1D9E75]/30 text-[#1D9E75]"
                      : i === currentStepIndex
                      ? "bg-[#1D9E75] text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i < currentStepIndex ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    i === currentStepIndex ? "text-[#1D9E75]" : "text-gray-400"
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 mb-4 h-px flex-1 transition-colors ${
                    i < currentStepIndex ? "bg-[#1D9E75]/40" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <form onSubmit={handleAnalyze} className="space-y-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors ${
                file
                  ? "border-[#1D9E75] bg-[#1D9E75]/5"
                  : "border-[#1D9E75]/40 bg-[#1D9E75]/5 hover:bg-[#1D9E75]/10"
              }`}
            >
              <span className="text-4xl">{file ? "🧾" : "📷"}</span>
              {file ? (
                <>
                  <p className="text-sm font-bold text-[#1D9E75]">✓ {file.name}</p>
                  <p className="text-xs text-gray-400">اضغط لاستبدال الصورة</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-[#1D9E75]">اضغط لرفع صورة الفاتورة</p>
                  <p className="text-xs text-gray-400">صورة أو PDF</p>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                setError(null);
              }}
            />

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={analyzing || !file}
              className="w-full rounded-2xl bg-[#1D9E75] py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  جاري التحليل...
                </span>
              ) : (
                "تحليل الفاتورة ←"
              )}
            </button>
          </form>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              راجع البيانات المستخرجة وعدّل إذا احتجت، ثم اضغط حفظ
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">
                  اسم المتجر
                </label>
                <input
                  type="text"
                  value={expense.store}
                  onChange={(e) => setExpense((p) => ({ ...p, store: e.target.value }))}
                  placeholder="مثال: ستاربكس"
                  className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm outline-none ring-[#1D9E75] focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">
                  المبلغ (ر.س)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expense.amount}
                  onChange={(e) => setExpense((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm outline-none ring-[#1D9E75] focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">
                  التاريخ
                </label>
                <input
                  type="date"
                  value={expense.date}
                  onChange={(e) => setExpense((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm outline-none ring-[#1D9E75] focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">
                  التصنيف
                </label>
                <select
                  value={expense.category}
                  onChange={(e) =>
                    setExpense((p) => ({ ...p, category: e.target.value as Category }))
                  }
                  className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm outline-none ring-[#1D9E75] focus:ring-2"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-2xl border-2 border-[#1D9E75] py-3 text-sm font-bold text-[#1D9E75] transition-opacity hover:opacity-70"
              >
                ← رجوع
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] rounded-2xl bg-[#1D9E75] py-3 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    جاري الحفظ...
                  </span>
                ) : (
                  "حفظ المصروف ✓"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Saved ── */}
        {step === "saved" && (
          <div className="flex flex-col items-center gap-6 py-4 text-center">
            <div className="flex size-24 items-center justify-center rounded-full bg-[#1D9E75]/10 text-5xl">
              ✅
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#1D9E75]">تم الحفظ!</p>
              <p className="mt-1 text-sm text-gray-500">تمت إضافة المصروف بنجاح</p>
            </div>
            <div className="flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-2xl bg-[#1D9E75] py-4 text-lg font-bold text-white transition-opacity hover:opacity-90"
              >
                أضف مصروفاً آخر
              </button>
              <Link
                href="/expenses"
                className="block w-full rounded-2xl border-2 border-[#1D9E75] py-4 text-center text-lg font-bold text-[#1D9E75] transition-opacity hover:opacity-90"
              >
                عرض مصاريفي
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
    </AuthGuard>
  );
}
