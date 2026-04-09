"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    if (authError) { setError(authError.message); setLoading(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6 py-10 font-sans">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg flex flex-col items-center gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#1D9E75] shadow">
            <span className="text-3xl font-extrabold text-white">ف</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1D9E75]">فطين</h1>
          <p className="text-center text-sm text-gray-500">سجّل دخولك لحفظ مصاريفك الخاصة</p>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-6 py-4 text-base font-bold text-gray-700 transition-all hover:border-gray-300 hover:shadow-md disabled:opacity-60"
        >
          {loading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <svg className="size-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? "جاري التحويل..." : "تسجيل الدخول بـ Google"}
        </button>

        {error && (
          <p className="w-full rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 text-center">{error}</p>
        )}

        <Link href="/" className="text-sm text-gray-400 hover:text-[#1D9E75]">
          العودة للرئيسية
        </Link>

        <p className="text-center text-xs text-gray-400">
          🔒 معلوماتك سرية ولا يتم مشاركتها مع أي طرف
        </p>
      </div>
    </main>
  );
}
