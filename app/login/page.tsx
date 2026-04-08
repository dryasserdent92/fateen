"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ── Google OAuth ── */
  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    if (authError) { setError(authError.message); setGoogleLoading(false); }
  }

  /* ── Magic link ── */
  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email.trim()) { setError("أدخل البريد الإلكتروني أولاً."); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined },
    });
    if (authError) { setError(authError.message); }
    else { setSuccess("تم إرسال رابط الدخول إلى بريدك الإلكتروني."); }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6 py-10 font-sans">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg sm:p-8">

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="grid size-14 place-items-center rounded-2xl bg-[#1D9E75]">
            <span className="text-2xl font-extrabold text-white">ف</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1D9E75]">تسجيل الدخول</h1>
          <p className="text-center text-sm text-gray-500">سجّل دخولك لحفظ مصاريفك الخاصة</p>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-6 py-4 text-base font-bold text-gray-700 transition-all hover:border-gray-300 hover:shadow-md disabled:opacity-60"
        >
          {googleLoading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <svg className="size-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {googleLoading ? "جاري التحويل..." : "تسجيل الدخول بـ Google"}
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">أو</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Magic link */}
        <form onSubmit={(e) => void handleMagicLink(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 outline-none ring-[#1D9E75] placeholder:text-gray-400 focus:ring-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#1D9E75]/10 px-6 py-3.5 text-base font-bold text-[#1D9E75] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loading ? "جاري الإرسال..." : "أرسل رابط الدخول بالإيميل"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{success}</p>
        )}

        <Link href="/" className="mt-6 block text-center text-sm text-gray-400 hover:text-[#1D9E75]">
          العودة للرئيسية
        </Link>

        {/* Privacy */}
        <p className="mt-6 text-center text-xs text-gray-400">
          🔒 معلوماتك سرية ولا يتم مشاركتها مع أي طرف
        </p>
      </div>
    </main>
  );
}
