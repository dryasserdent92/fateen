"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AuthGuard from "../components/auth-guard";
import BottomNav from "../components/bottom-nav";
import { loadSettings, saveSettings } from "../../lib/user-settings";

export default function SettingsPage() {
  const router = useRouter();
  const [userName, setUserName]   = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [startDay, setStartDay] = useState<number>(1);
  const [budget, setBudget] = useState<number>(0);
  const [settingsSaved, setSettingsSaved] = useState(false);

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
    const s = loadSettings();
    setStartDay(s.startDay);
    setBudget(s.budget);
  }, []);

  function handleSaveSettings() {
    saveSettings({ startDay, budget });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
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

          {/* إعدادات الشهر والميزانية */}
          <div className="rounded-3xl bg-white p-5 shadow-lg space-y-4">
            <p className="text-xs font-bold text-gray-400 px-1">إعدادات المصاريف</p>

            {/* يوم بداية الشهر */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">📅 يوم بداية الشهر</label>
              <p className="text-xs text-gray-400">مثال: 27 يعني الشهر يبدأ في اليوم 27 من كل شهر</p>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={startDay}
                  onChange={e => setStartDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold text-[#1D9E75] outline-none focus:border-[#1D9E75]"
                />
                <span className="text-sm text-gray-500">من كل شهر</span>
              </div>
            </div>

            {/* الميزانية */}
            <div className="space-y-1.5 border-t border-gray-100 pt-4">
              <label className="text-sm font-semibold text-gray-700">💰 الميزانية الشهرية</label>
              <p className="text-xs text-gray-400">اتركها 0 إذا لم تريد تحديد ميزانية</p>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={0}
                  value={budget === 0 ? "" : budget}
                  placeholder="0"
                  onChange={e => setBudget(parseFloat(e.target.value) || 0)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-lg font-bold text-[#1D9E75] outline-none focus:border-[#1D9E75]"
                />
                <span className="text-sm text-gray-500 flex-shrink-0">ر.س</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full rounded-2xl bg-[#1D9E75] py-3 text-base font-bold text-white shadow transition-opacity hover:opacity-90"
            >
              {settingsSaved ? "✅ تم الحفظ!" : "حفظ الإعدادات"}
            </button>
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
