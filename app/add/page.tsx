"use client";

import { FormEvent, useMemo, useState } from "react";

type ExpenseCategory =
  | "مطاعم"
  | "قهوة"
  | "بنزين"
  | "سوبرماركت"
  | "تسوق"
  | "أخرى";

type AnalyzeResponse = {
  store: string | null;
  amount: number | null;
  date: string | null;
  category: ExpenseCategory;
};

export default function AddExpensePage() {
  const [smsText, setSmsText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const hasInput = useMemo(() => smsText.trim().length > 0 || !!file, [smsText, file]);

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!hasInput) {
      setError("أدخل نص SMS أو ارفع صورة فاتورة أولًا.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (smsText.trim()) formData.append("smsText", smsText.trim());
      if (file) formData.append("image", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as AnalyzeResponse & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "تعذر تحليل البيانات.");
        return;
      }

      setResult(data);
    } catch {
      setError("حدث خطأ غير متوقع أثناء التحليل.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6 py-10 font-sans">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="mb-6 text-center text-3xl font-extrabold text-[#1D9E75]">
          إضافة مصروف
        </h1>

        <form onSubmit={handleAnalyze} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="receipt-image" className="block text-sm font-semibold text-[#1D9E75]">
              1) رفع صورة فاتورة
            </label>
            <input
              id="receipt-image"
              name="image"
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-xl border border-[#1D9E75]/30 bg-white p-3 text-sm text-gray-700 file:ml-3 file:rounded-lg file:border-0 file:bg-[#1D9E75] file:px-4 file:py-2 file:text-white file:hover:opacity-90"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="sms-text" className="block text-sm font-semibold text-[#1D9E75]">
              2) لصق نص SMS
            </label>
            <textarea
              id="sms-text"
              name="smsText"
              rows={5}
              value={smsText}
              onChange={(event) => setSmsText(event.target.value)}
              placeholder="مثال: تم خصم 24.50 ريال لدى متجر ..."
              className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm text-gray-800 outline-none ring-[#1D9E75] placeholder:text-gray-400 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#1D9E75] px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "جاري التحليل..." : "3) تحليل"}
          </button>
        </form>

        {error ? (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {result ? (
          <section className="mt-6 rounded-2xl border border-[#1D9E75]/25 bg-[#1D9E75]/5 p-5">
            <h2 className="mb-4 text-lg font-bold text-[#1D9E75]">4) نتيجة التحليل</h2>
            <div className="space-y-2 text-sm text-gray-800">
              <p>
                <span className="font-semibold text-[#1D9E75]">المتجر:</span>{" "}
                {result.store ?? "-"}
              </p>
              <p>
                <span className="font-semibold text-[#1D9E75]">المبلغ:</span>{" "}
                {result.amount ?? "-"}
              </p>
              <p>
                <span className="font-semibold text-[#1D9E75]">التاريخ:</span>{" "}
                {result.date ?? "-"}
              </p>
              <p>
                <span className="font-semibold text-[#1D9E75]">التصنيف:</span>{" "}
                {result.category}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
