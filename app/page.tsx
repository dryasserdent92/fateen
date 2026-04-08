"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6 font-sans">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-20 place-items-center rounded-2xl bg-white shadow-lg">
            <span className="text-3xl font-extrabold text-[#1D9E75]">ف</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white">فطين</h1>
          <p className="text-sm font-medium text-white/70">افهم مصاريفك بدون ما تكتب ولا ريال</p>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/add"
            className="w-full rounded-2xl bg-white px-6 py-4 text-lg font-semibold text-[#1D9E75] shadow transition-opacity hover:opacity-90"
          >
            + أضف مصروف
          </Link>

          <Link
            href="/expenses"
            className="w-full rounded-2xl border-2 border-white bg-transparent px-6 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
          >
            مصاريفي
          </Link>

          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full rounded-2xl bg-white/15 px-6 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
            >
              تسجيل الخروج
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full rounded-2xl bg-white/15 px-6 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
            >
              تسجيل الدخول
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
