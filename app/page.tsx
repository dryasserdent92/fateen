"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [userName, setUserName]         = useState<string | null>(null);
  const [expenseCount, setExpenseCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsLoggedIn(true);
        const meta = data.session.user.user_metadata as Record<string, string> | undefined;
        const name = meta?.["full_name"] ?? meta?.["name"] ?? data.session.user.email?.split("@")[0] ?? null;
        setUserName(name);
        // جلب عدد المصاريف لمعرفة هل هو مستخدم جديد
        void supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.session.user.id)
          .then(({ count }) => setExpenseCount(count ?? 0));
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        const meta = session.user.user_metadata as Record<string, string> | undefined;
        const name = meta?.["full_name"] ?? meta?.["name"] ?? session.user.email?.split("@")[0] ?? null;
        setUserName(name);
        void supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .then(({ count }) => setExpenseCount(count ?? 0));
      } else {
        setUserName(null);
        setExpenseCount(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUserName(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#1D9E75] px-6 py-10 font-sans">

      {/* محتوى رئيسي */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 text-center">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-20 place-items-center rounded-2xl bg-white shadow-lg">
            <span className="text-3xl font-extrabold text-[#1D9E75]">ف</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white">فطين</h1>
          <p className="text-sm font-medium text-white/70">افهم مصاريفك بدون ما تكتب ولا ريال</p>
        </div>

        {/* Welcome badge */}
        {isLoggedIn && userName && (
          <div className="flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-2.5">
            <span className="text-lg">👋</span>
            <p className="text-sm font-bold text-white">مرحباً، {userName}</p>
            {expenseCount !== null && expenseCount > 0 && (
              <span className="mr-1 rounded-full bg-white/30 px-2 py-0.5 text-xs text-white">
                {expenseCount} مصروف
              </span>
            )}
          </div>
        )}

        {/* توجيه المستخدم الجديد */}
        {isLoggedIn && expenseCount === 0 && (
          <div className="w-full rounded-2xl bg-white/10 border border-white/20 px-5 py-4 text-center">
            <p className="text-sm font-bold text-white">🚀 ابدأ بتسجيل أول مصروف</p>
            <p className="mt-1 text-xs text-white/70">ارفع صورة فاتورة أو الصق رسالة بنكية</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/add"
            className="w-full rounded-2xl bg-white px-6 py-4 text-lg font-semibold text-[#1D9E75] shadow transition-opacity hover:opacity-90"
          >
            + أضف مصروف
          </Link>

          {/* زر المصاريف — يظهر فقط إذا عنده مصاريف أو لم نعرف بعد */}
          {(expenseCount === null || expenseCount > 0) && (
            <div className="flex gap-3">
              <Link
                href="/expenses"
                className="flex-1 rounded-2xl border-2 border-white bg-transparent px-6 py-4 text-center text-lg font-semibold text-white transition-opacity hover:opacity-90"
              >
                مصاريفي {expenseCount !== null && expenseCount > 0 ? `(${expenseCount})` : ""}
              </Link>
              <Link
                href="/reports"
                className="rounded-2xl border-2 border-white bg-transparent px-5 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
              >
                📊
              </Link>
            </div>
          )}

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

      {/* Footer */}
      <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-2 text-center">
        <p className="text-xs text-white/50">
          🔒 معلوماتك سرية ولا يتم مشاركتها مع أي طرف
        </p>
        <p className="text-xs text-white/40">
          صُمِّم وطُوِّر بواسطة <span className="font-semibold text-white/60">ياسر المنجم</span>
        </p>
      </div>

    </main>
  );
}
