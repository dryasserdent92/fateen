"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AuthGuard from "../components/auth-guard";
import BottomNav from "../components/bottom-nav";
import { loadSettings, saveSettings, type CustomCategory } from "../../lib/user-settings";

const EMOJI_PRESETS = ["🏠","🎓","✈️","🎮","🐾","💼","🍕","🎵","📚","🎨","🔧","💇","🎁","🏖️","💊","☎️","🧴","🛁","⚽","🌿"];

export default function SettingsPage() {
  const router = useRouter();
  const [userName, setUserName]   = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [startDay, setStartDay] = useState<number>(1);
  const [budget, setBudget] = useState<number>(0);
  const [settingsSaved, setSettingsSaved] = useState(false);

  /* التصنيفات المخصصة */
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🏷️");

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
    setCustomCategories(s.customCategories);
  }, []);

  function handleSaveSettings() {
    saveSettings({ startDay, budget, customCategories });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  /* إضافة/حذف تصنيف مع حفظ فوري */
  function addCategory() {
    if (!newCatName.trim()) return;
    const updated = [...customCategories, { name: newCatName.trim(), icon: newCatIcon }];
    setCustomCategories(updated);
    saveSettings({ startDay, budget, customCategories: updated });
    setNewCatName("");
    setNewCatIcon("🏷️");
  }

  function deleteCategory(idx: number) {
    const updated = customCategories.filter((_, i) => i !== idx);
    setCustomCategories(updated);
    saveSettings({ startDay, budget, customCategories: updated });
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

          {/* ── التصنيفات المخصصة ── */}
          <div className="rounded-3xl bg-white p-5 shadow-lg space-y-4">
            <p className="text-xs font-bold text-gray-400 px-1">تصنيفاتي المخصصة</p>

            {/* قائمة التصنيفات الحالية */}
            {customCategories.length === 0 ? (
              <p className="rounded-2xl bg-gray-50 py-4 text-center text-sm text-gray-400">
                لا توجد تصنيفات مخصصة بعد
              </p>
            ) : (
              <div className="space-y-2">
                {customCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-sm font-bold text-gray-700">{cat.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCategory(idx)}
                      className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-100 transition-colors"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* إضافة تصنيف جديد */}
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-bold text-gray-700">➕ إضافة تصنيف جديد</p>

              {/* اختيار الرمز */}
              <div>
                <p className="mb-2 text-xs text-gray-400">اختر رمزاً أو اكتب أي إيموجي</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {EMOJI_PRESETS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setNewCatIcon(e)}
                      className={`flex size-10 items-center justify-center rounded-xl text-xl transition-all ${
                        newCatIcon === e
                          ? "bg-[#1D9E75]/15 ring-2 ring-[#1D9E75]"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >{e}</button>
                  ))}
                  {/* إدخال إيموجي حر */}
                  <input
                    type="text"
                    value={newCatIcon}
                    onChange={e => { if (e.target.value.trim()) setNewCatIcon(e.target.value.trim()); }}
                    maxLength={4}
                    placeholder="✏️"
                    className="flex size-10 items-center justify-center rounded-xl border border-dashed border-gray-300 text-center text-xl outline-none focus:border-[#1D9E75]"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  الرمز المختار: <span className="text-xl">{newCatIcon}</span>
                </p>
              </div>

              {/* اسم التصنيف + زر الإضافة */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
                  placeholder="اسم التصنيف..."
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
                />
                <button
                  type="button"
                  disabled={!newCatName.trim()}
                  onClick={addCategory}
                  className="rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-bold text-white shadow disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  أضف
                </button>
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
