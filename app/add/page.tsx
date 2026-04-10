"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthGuard from "../components/auth-guard";
import { supabase } from "../../lib/supabase";
import { apiUrl } from "../../lib/api-client";

const CATEGORIES = ["مطاعم", "قهوة", "بنزين", "سوبرماركت", "تسوق", "صحة", "فواتير", "أخرى"] as const;
type Category = (typeof CATEGORIES)[number];
type InputMethod = "image" | "sms" | "voice";
type Step = "input" | "review" | "saved";

const STEPS: Step[] = ["input", "review", "saved"];
const STEP_LABELS = ["إدخال", "مراجعة", "حفظ"];

const INPUT_TABS: { id: InputMethod; label: string; icon: string }[] = [
  { id: "image", label: "صورة", icon: "📷" },
  { id: "sms",   label: "SMS",   icon: "💬" },
  { id: "voice", label: "صوت",   icon: "🎤" },
];

type ExpenseItem = {
  name: string;
  brand: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type ExtractedExpense = {
  store: string;
  amount: string;
  date: string;
  category: Category;
  item_name: string;
  item_brand: string;
  items: ExpenseItem[] | null;
};

/* ── Web Speech API types ── */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const VOICE_DURATION = 15; /* ثواني */

/* تاريخ اليوم بتوقيت السعودية +3 */
function todaySA(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

const ANALYZING_MESSAGES = [
  "🔍 فطين يقرأ فاتورتك...",
  "✨ يستخرج البيانات...",
  "🧠 يحلل المعلومات...",
  "📊 يرتّب النتائج...",
];

export default function AddExpensePage() {
  const [step, setStep]             = useState<Step>("input");
  const [method, setMethod]         = useState<InputMethod>("image");

  /* image */
  const [file, setFile]             = useState<File | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  /* sms */
  const [smsText, setSmsText]       = useState("");

  /* voice */
  const [recording, setRecording]   = useState(false);
  const [countdown, setCountdown]   = useState(VOICE_DURATION);
  const [transcript, setTranscript] = useState("");
  const recognitionRef              = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* analyzing animation */
  const [analyzeMsg, setAnalyzeMsg] = useState(0);
  const analyzeMsgRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  /* shared */
  const [analyzing, setAnalyzing]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [savedAmount, setSavedAmount] = useState<number | null>(null);
  const [expense, setExpense]       = useState<ExtractedExpense>({
    store: "", amount: "", date: todaySA(), category: "أخرى",
    item_name: "", item_brand: "", items: null,
  });

  /* cleanup on unmount */
  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (analyzeMsgRef.current) clearInterval(analyzeMsgRef.current);
  }, []);

  /* ── Voice recording ── */
  function startRecording() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setError("المتصفح لا يدعم التعرف على الصوت، جرب Chrome"); return; }

    setTranscript("");
    setError(null);
    setCountdown(VOICE_DURATION);

    const recognition = new SR();
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i]![0]!.transcript;
      }
      setTranscript(text);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(`خطأ في الميكروفون: ${e.error}`);
      stopRecording();
    };

    recognition.start();
    setRecording(true);

    /* countdown */
    let remaining = VOICE_DURATION;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setCountdown(VOICE_DURATION);
  }

  /* ── Analyze ── */
  async function handleAnalyze() {
    setError(null);

    /* validation */
    if (method === "image" && !file)           { setError("ارفع صورة فاتورة أولاً"); return; }
    if (method === "sms"   && !smsText.trim()) { setError("الصق نص الرسالة أولاً"); return; }
    if (method === "voice" && !transcript.trim()) { setError("لم يُسجَّل أي كلام، حاول مجدداً"); return; }

    setAnalyzing(true);
    setAnalyzeMsg(0);
    analyzeMsgRef.current = setInterval(() => {
      setAnalyzeMsg((prev) => (prev + 1) % ANALYZING_MESSAGES.length);
    }, 1800);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      if (method === "image" && file)          formData.append("image", file);
      if (method === "sms")                    formData.append("smsText", smsText.trim());
      if (method === "voice")                  formData.append("smsText", transcript.trim());

      const res  = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        headers: session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      const data = (await res.json()) as {
        expense?: Record<string, unknown>;
        mergedExpense?: Record<string, unknown>;
        expenses?: Record<string, unknown>[];
        error?: string;
      };
      if (!res.ok) { setError(data.error ?? "فشل التحليل"); return; }

      const raw = data.expense ?? data.mergedExpense ?? data.expenses?.[0];
      if (raw) {
        setExpense({
          store:      String(raw["store"]      ?? ""),
          amount:     String(raw["amount"]     ?? ""),
          date:       String(raw["date"]       ?? todaySA()),
          category:   (raw["category"] as Category) ?? "أخرى",
          item_name:  String(raw["item_name"]  ?? ""),
          item_brand: String(raw["item_brand"] ?? ""),
          items:      Array.isArray(raw["items"]) && (raw["items"] as unknown[]).length > 0
                        ? (raw["items"] as ExpenseItem[])
                        : null,
        });
      }
      setStep("review");
    } catch {
      setError("حدث خطأ، حاول مجدداً");
    } finally {
      setAnalyzing(false);
      if (analyzeMsgRef.current) { clearInterval(analyzeMsgRef.current); analyzeMsgRef.current = null; }
    }
  }

  /* ── Save ── */
  async function handleSave() {
    const parsedAmount = parseFloat(expense.amount);
    if (!expense.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("أدخل مبلغاً صحيحاً — المبلغ لا يمكن أن يكون صفراً"); return;
    }
    setError(null);
    setSaving(true);
    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError || !session?.access_token) {
        setError("تعذر التحقق من هويتك، سجّل الدخول مجدداً.");
        return;
      }

      const res = await fetch(apiUrl("/api/save"), {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          store:      expense.store || null,
          amount:     parseFloat(expense.amount),
          date:       expense.date,
          category:   expense.category,
          item_name:  expense.item_name  || null,
          item_brand: expense.item_brand || null,
          items:      expense.items ?? null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "فشل الحفظ"); return; }
      setSavedAmount(parseFloat(expense.amount));
      setStep("saved");
    } catch {
      setError("حدث خطأ، حاول مجدداً");
    } finally {
      setSaving(false);
    }
  }

  /* ── Reset ── */
  function reset() {
    setStep("input");
    setFile(null);
    setSmsText("");
    setTranscript("");
    setError(null);
    setSavedAmount(null);
    stopRecording();
    setExpense({ store: "", amount: "", date: todaySA(), category: "أخرى", item_name: "", item_brand: "", items: null });
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
              <Link href="/" className="text-2xl leading-none text-[#1D9E75] hover:opacity-70">←</Link>
            )}
            <h1 className="text-2xl font-extrabold text-[#1D9E75]">
              {step === "input"  && "أضف مصروف"}
              {step === "review" && "مراجعة البيانات"}
              {step === "saved"  && "تم الحفظ ✓"}
            </h1>
          </div>

          {/* Progress */}
          <div className="mb-8 flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i < currentStepIndex ? "bg-[#1D9E75]/30 text-[#1D9E75]"
                    : i === currentStepIndex ? "bg-[#1D9E75] text-white"
                    : "bg-gray-100 text-gray-400"
                  }`}>
                    {i < currentStepIndex ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-semibold ${i === currentStepIndex ? "text-[#1D9E75]" : "text-gray-400"}`}>
                    {STEP_LABELS[i]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 mb-4 h-px flex-1 transition-colors ${i < currentStepIndex ? "bg-[#1D9E75]/40" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          {/* ── Step 1: Input ── */}
          {step === "input" && (
            <div className="space-y-5">

              {/* Input method tabs */}
              <div className="flex rounded-2xl bg-gray-100 p-1">
                {INPUT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setMethod(tab.id); setError(null); }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all ${
                      method === tab.id
                        ? "bg-white text-[#1D9E75] shadow"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* ── Image ── */}
              {method === "image" && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors ${
                      file ? "border-[#1D9E75] bg-[#1D9E75]/5" : "border-[#1D9E75]/40 bg-[#1D9E75]/5 hover:bg-[#1D9E75]/10"
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
                    onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
                  />
                </>
              )}

              {/* ── SMS ── */}
              {method === "sms" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">الصق رسالة البنك أو أي نص يحتوي تفاصيل المصروف</p>
                  <textarea
                    rows={5}
                    value={smsText}
                    onChange={(e) => { setSmsText(e.target.value); setError(null); }}
                    placeholder={"مثال:\nتم خصم 24.50 ريال من حسابك لدى ستاربكس بتاريخ 2025/04/08"}
                    className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm text-gray-800 outline-none ring-[#1D9E75] placeholder:text-gray-300 focus:ring-2"
                  />
                </div>
              )}

              {/* ── Voice ── */}
              {method === "voice" && (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-xs text-gray-400 text-center">
                    اضغط ابدأ ثم تكلم، فطين سيستمع {VOICE_DURATION} ثانية ويستخرج البيانات
                  </p>

                  {/* Mic button */}
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    className={`relative flex size-24 items-center justify-center rounded-full text-4xl shadow-lg transition-all ${
                      recording
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-[#1D9E75] text-white hover:opacity-90"
                    }`}
                  >
                    {recording ? "⏹" : "🎤"}
                    {recording && (
                      <span className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-white text-sm font-extrabold text-red-500 shadow">
                        {countdown}
                      </span>
                    )}
                  </button>

                  <p className="text-sm font-semibold text-gray-500">
                    {recording ? "يستمع... تكلم الآن" : transcript ? "تم التسجيل" : "اضغط للبدء"}
                  </p>

                  {/* Transcript preview */}
                  {transcript && (
                    <div className="w-full rounded-2xl border border-[#1D9E75]/30 bg-[#1D9E75]/5 p-4">
                      <p className="mb-1 text-xs font-semibold text-[#1D9E75]">ما قلته:</p>
                      <p className="text-sm text-gray-700">{transcript}</p>
                      <button
                        type="button"
                        onClick={() => { setTranscript(""); setError(null); }}
                        className="mt-2 text-xs text-red-400 hover:underline"
                      >
                        مسح وإعادة التسجيل
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>
              )}

              {analyzing ? (
                <div className="w-full rounded-2xl bg-[#1D9E75]/10 border-2 border-[#1D9E75]/20 py-6 flex flex-col items-center gap-3">
                  <div className="size-10 animate-spin rounded-full border-4 border-[#1D9E75]/30 border-t-[#1D9E75]" />
                  <p className="text-base font-bold text-[#1D9E75] transition-all">
                    {ANALYZING_MESSAGES[analyzeMsg]}
                  </p>
                  <p className="text-xs text-gray-400">فطين يعمل بذكاء اصطناعي ⚡</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  disabled={recording}
                  className="w-full rounded-2xl bg-[#1D9E75] py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  تحليل ←
                </button>
              )}
            </div>
          )}

          {/* ── Step 2: Review ── */}
          {step === "review" && (
            <div className="space-y-5">
              {/* تلميح المراجعة */}
              <div className="flex items-start gap-2 rounded-2xl bg-[#1D9E75]/8 border border-[#1D9E75]/20 px-4 py-3">
                <span className="text-lg shrink-0">✅</span>
                <p className="text-sm text-[#1D9E75] font-medium leading-relaxed">
                  استخرجنا هذه البيانات تلقائياً — راجعها وعدّل إذا احتجت، ثم اضغط حفظ
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">اسم المتجر</label>
                  <input type="text" value={expense.store}
                    onChange={(e) => setExpense((p) => ({ ...p, store: e.target.value }))}
                    placeholder="مثال: ستاربكس"
                    className={`w-full rounded-xl border p-3 text-sm text-gray-900 outline-none ring-[#1D9E75] focus:ring-2 ${
                      !expense.store ? "border-amber-300 bg-amber-50" : "border-[#1D9E75]/30"
                    }`}
                  />
                  {!expense.store && <p className="text-xs text-amber-500 mt-1">⚠️ لم يُتعرَّف على المتجر — يمكنك إدخاله يدوياً</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">المبلغ (ر.س)</label>
                  <input type="number" step="0.01" min="0" value={expense.amount}
                    onChange={(e) => setExpense((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className={`w-full rounded-xl border p-3 text-sm text-gray-900 outline-none ring-[#1D9E75] focus:ring-2 ${
                      !expense.amount || parseFloat(expense.amount) <= 0 ? "border-red-300 bg-red-50" : "border-[#1D9E75]/30"
                    }`}
                  />
                  {(!expense.amount || parseFloat(expense.amount) <= 0) && (
                    <p className="text-xs font-semibold text-red-500 mt-1">
                      ⚠️ المبلغ غير محدد — أدخله يدوياً قبل الحفظ
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">التاريخ</label>
                  <input type="date" value={expense.date}
                    onChange={(e) => setExpense((p) => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm text-gray-900 outline-none ring-[#1D9E75] focus:ring-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">التصنيف</label>
                  <select value={expense.category}
                    onChange={(e) => setExpense((p) => ({ ...p, category: e.target.value as Category }))}
                    className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm text-gray-900 outline-none ring-[#1D9E75] focus:ring-2"
                  >
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {/* ── الأصناف المتعددة (قابلة للتعديل) ── */}
                {expense.items && expense.items.length > 0 ? (
                  <div className="rounded-2xl border border-[#1D9E75]/20 bg-[#1D9E75]/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#1D9E75] uppercase tracking-wide">
                        🛒 الأصناف ({expense.items.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const newItem: ExpenseItem = { name: "", brand: null, quantity: 1, unit_price: 0, total_price: 0 };
                          const updated = [...expense.items!, newItem];
                          setExpense((p) => ({ ...p, items: updated }));
                        }}
                        className="text-xs font-bold text-[#1D9E75] bg-white border border-[#1D9E75]/30 rounded-xl px-3 py-1 hover:bg-[#1D9E75]/10"
                      >
                        + إضافة صنف
                      </button>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {expense.items.map((item, idx) => (
                        <div key={idx} className="rounded-xl bg-white border border-[#1D9E75]/15 p-3 space-y-2">
                          {/* اسم الصنف + زر الحذف */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const updated = [...expense.items!];
                                updated[idx] = { ...updated[idx]!, name: e.target.value };
                                setExpense((p) => ({ ...p, items: updated }));
                              }}
                              placeholder="اسم الصنف"
                              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-[#1D9E75]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = expense.items!.filter((_, i) => i !== idx);
                                const newTotal = updated.reduce((s, it) => s + it.total_price, 0);
                                setExpense((p) => ({
                                  ...p,
                                  items: updated.length > 0 ? updated : null,
                                  amount: newTotal > 0 ? String(newTotal.toFixed(2)) : p.amount,
                                }));
                              }}
                              className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none"
                              title="حذف الصنف"
                            >
                              ×
                            </button>
                          </div>

                          {/* الكمية × السعر = المجموع */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <p className="text-[10px] text-gray-400 mb-0.5">الكمية</p>
                              <input
                                type="number" min="1" step="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const qty = parseFloat(e.target.value) || 1;
                                  const updated = [...expense.items!];
                                  const total = parseFloat((qty * updated[idx]!.unit_price).toFixed(2));
                                  updated[idx] = { ...updated[idx]!, quantity: qty, total_price: total };
                                  const newTotal = updated.reduce((s, it) => s + it.total_price, 0);
                                  setExpense((p) => ({ ...p, items: updated, amount: String(newTotal.toFixed(2)) }));
                                }}
                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-[#1D9E75]"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] text-gray-400 mb-0.5">سعر الوحدة</p>
                              <input
                                type="number" min="0" step="0.01"
                                value={item.unit_price}
                                onChange={(e) => {
                                  const price = parseFloat(e.target.value) || 0;
                                  const updated = [...expense.items!];
                                  const total = parseFloat((updated[idx]!.quantity * price).toFixed(2));
                                  updated[idx] = { ...updated[idx]!, unit_price: price, total_price: total };
                                  const newTotal = updated.reduce((s, it) => s + it.total_price, 0);
                                  setExpense((p) => ({ ...p, items: updated, amount: String(newTotal.toFixed(2)) }));
                                }}
                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-[#1D9E75]"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] text-gray-400 mb-0.5">الإجمالي</p>
                              <div className="rounded-lg bg-[#1D9E75]/10 border border-[#1D9E75]/20 px-2 py-1.5 text-sm font-bold text-[#1D9E75] text-center">
                                {item.total_price.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* مجموع الأصناف */}
                    <div className="flex items-center justify-between rounded-xl bg-[#1D9E75]/15 px-4 py-2.5">
                      <span className="text-sm font-bold text-[#1D9E75]">مجموع الأصناف</span>
                      <span className="text-base font-extrabold text-[#1D9E75]">
                        {expense.items.reduce((s, it) => s + it.total_price, 0).toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>
                ) : (
                  /* ── السلعة والماركة (للمشتريات الأحادية) ── */
                  <div className="rounded-2xl border border-[#1D9E75]/20 bg-[#1D9E75]/5 p-4 space-y-3">
                    <p className="text-xs font-bold text-[#1D9E75]/70 uppercase tracking-wide">تفاصيل السلعة (اختياري)</p>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">اسم السلعة</label>
                      <input type="text" value={expense.item_name}
                        onChange={(e) => setExpense((p) => ({ ...p, item_name: e.target.value }))}
                        placeholder="مثال: أرز، قهوة، حليب"
                        className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm text-gray-900 outline-none ring-[#1D9E75] focus:ring-2"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#1D9E75]">ماركة السلعة</label>
                      <input type="text" value={expense.item_brand}
                        onChange={(e) => setExpense((p) => ({ ...p, item_brand: e.target.value }))}
                        placeholder="مثال: رز الشعلان، نسكافيه، المراعي"
                        className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm text-gray-900 outline-none ring-[#1D9E75] focus:ring-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={reset}
                  className="flex-1 rounded-2xl border-2 border-[#1D9E75] py-3 text-sm font-bold text-[#1D9E75] transition-opacity hover:opacity-70">
                  ← رجوع
                </button>
                <button type="button" onClick={() => void handleSave()} disabled={saving}
                  className="flex-[2] rounded-2xl bg-[#1D9E75] py-3 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      جاري الحفظ...
                    </span>
                  ) : "حفظ المصروف ✓"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Saved ── */}
          {step === "saved" && (
            <div className="flex flex-col items-center gap-5 py-2 text-center">
              {/* أيقونة النجاح */}
              <div className="flex size-28 items-center justify-center rounded-full bg-[#1D9E75]/10 text-6xl animate-bounce">
                🎉
              </div>

              <div>
                <p className="text-2xl font-extrabold text-[#1D9E75]">تم الحفظ بنجاح!</p>
                <p className="mt-1 text-sm text-gray-400">
                  {expense.store ? `${expense.store} ·` : ""} تمت الإضافة لسجل مصاريفك
                </p>
              </div>

              {/* بطاقة المبلغ */}
              {savedAmount !== null && (
                <div className="w-full rounded-2xl bg-[#1D9E75]/8 border border-[#1D9E75]/20 py-4 px-6">
                  <p className="text-xs font-medium text-gray-400 mb-1">المبلغ المسجّل</p>
                  <p className="text-4xl font-extrabold text-[#1D9E75]">
                    {savedAmount.toFixed(2)}
                    <span className="mr-1 text-lg font-semibold text-gray-400">ر.س</span>
                  </p>
                </div>
              )}

              <div className="flex w-full flex-col gap-3 pt-1">
                <button type="button" onClick={reset}
                  className="w-full rounded-2xl bg-[#1D9E75] py-4 text-lg font-bold text-white transition-opacity hover:opacity-90">
                  + أضف مصروفاً آخر
                </button>
                <Link href="/expenses"
                  className="block w-full rounded-2xl border-2 border-[#1D9E75] py-4 text-center text-lg font-bold text-[#1D9E75] transition-opacity hover:opacity-90">
                  عرض كل مصاريفي
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>
    </AuthGuard>
  );
}
