"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("أدخل البريد الإلكتروني أولًا.");
      return;
    }

    setLoading(true);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess("تم إرسال رابط الدخول إلى بريدك الإلكتروني.");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6 py-10 font-sans">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="mb-2 text-center text-3xl font-extrabold text-[#1D9E75]">
          تسجيل الدخول
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          أدخل بريدك الإلكتروني وسنرسل لك رابط دخول مباشر بدون كلمة سر.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-[#1D9E75]"
            >
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#1D9E75]/30 p-3 text-sm text-gray-800 outline-none ring-[#1D9E75] placeholder:text-gray-400 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#1D9E75] px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "جاري الإرسال..." : "أرسل رابط الدخول"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {success}
          </p>
        ) : null}

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-semibold text-[#1D9E75] hover:underline"
        >
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
