"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AuthGuard from "../components/auth-guard";
import BottomNav from "../components/bottom-nav";

export default function SettingsPage() {
  const router = useRouter();
  const [userName, setUserName]   = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [cleaning, setCleaning]     = useState(false);
  const [cleanMsg, setCleanMsg]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const meta  = data.session.user.user_metadata as Record<string, string> | undefined;
        const name  = meta?.["full_name"] ?? meta?.["name"] ?? data.session.user.email?.split("@")[0] ?? null;
        const avatar = meta?.["avatar_url"] ?? null;
        setUserName(name);
        setUserEmail(data.session.user.email ?? null);
        setUserAvatar(avatar);
      }
    });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleCleanZeroAmounts() {
    if (!confirm("سيتم حذف جميع المصاريف المحفوظة بمبلغ صفر. هل تريد المتابعة؟")) return;
    setCleaning(true);
    setCleanMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/fix-amounts", {
        method: "DELETE",
        headers: session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {},
      });
      const json = (await res.json()) as { deleted?: number; error?: string };
      if (res.ok) {
        setCleanMsg(json.deleted === 0 ? "✅ لا توجد مصاريف بمبلغ صفر" : `✅ تم حذف ${json.deleted} مصروف بمبلغ صفر`);
      } else {
        setCleanMsg(`❌ ${json.error ?? "حدث خطأ"}`);
      }
    } catch {
      setCleanMsg("❌ تعذر الاتصال بالسيرفر");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#1D9E75] px-4 pb-28 pt-10 font-sans">
        <div className="mx-auto w-full max-w-xl space-y-4">

          {/* Header */}
          <h1 className="px-1 text-2xl font-extrabold text-white">الإعدادات</h1>

          {/* Profile Card */}
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <div className="flex items-center gap-4">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName ?? ""}
                  className="size-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full bg-[#1D9E75]/15 text-3xl">
                  👤
                </div>
              )}
              <div>
                <p className="text-lg font-extrabold text-gray-800">{userName ?? "..."}</p>
                <p className="text-sm text-gray-400">{userEmail ?? ""}</p>
                <span className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">
                  Google
                </span>
              </div>
            </div>
          </div>

          {/* App info */}
          <div className="rounded-3xl bg-white p-5 shadow-lg space-y-4">
            <p className="text-xs font-bold text-gray-400 px-1">حول فطين</p>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">الإصدار</span>
              <span className="text-sm text-gray-400">1.0.0</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">🔒 خصوصية البيانات</span>
              <span className="text-sm text-gray-400">معلوماتك سرية تماماً</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-gray-700">👨‍💻 تصميم وتطوير</span>
              <span className="text-sm font-bold text-[#1D9E75]">ياسر المنجم</span>
            </div>
          </div>

          {/* تنظيف المصاريف الصفرية */}
          <div className="rounded-3xl bg-white p-5 shadow-lg space-y-3">
            <p className="text-xs font-bold text-gray-400">صيانة البيانات</p>
            <p className="text-xs text-gray-500">
              إذا كانت بعض مصاريفك تظهر بمبلغ صفر، اضغط هنا لحذفها تلقائياً.
            </p>
            {cleanMsg && (
              <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">{cleanMsg}</p>
            )}
            <button
              type="button"
              onClick={() => void handleCleanZeroAmounts()}
              disabled={cleaning}
              className="w-full rounded-2xl border border-orange-200 bg-orange-50 py-3 text-sm font-bold text-orange-600 transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {cleaning ? "⏳ جاري التنظيف..." : "🧹 حذف المصاريف بمبلغ صفر"}
            </button>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="w-full rounded-3xl bg-white py-4 text-base font-bold text-red-500 shadow-lg transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loggingOut ? "جاري تسجيل الخروج..." : "🚪 تسجيل الخروج"}
          </button>

        </div>
      </main>
      <BottomNav />
    </AuthGuard>
  );
}
