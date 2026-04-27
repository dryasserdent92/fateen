// إعدادات المستخدم المحفوظة في localStorage

export interface UserSettings {
  startDay: number;   // يوم بداية الشهر (1-28)، افتراضي 1
  budget: number;     // الميزانية الشهرية (0 = غير محددة)
}

const KEY = "fateen_settings";

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return { startDay: 1, budget: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { startDay: 1, budget: 0 };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      startDay: typeof parsed.startDay === "number" && parsed.startDay >= 1 && parsed.startDay <= 28
        ? parsed.startDay : 1,
      budget: typeof parsed.budget === "number" && parsed.budget >= 0 ? parsed.budget : 0,
    };
  } catch { return { startDay: 1, budget: 0 }; }
}

export function saveSettings(s: UserSettings) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/**
 * يحسب تاريخ بداية الفترة الحالية بناءً على يوم البداية المخصص.
 * مثال: startDay=27، اليوم 2026-04-27 → بداية 2026-04-27
 *        startDay=27، اليوم 2026-04-26 → بداية 2026-03-27
 */
export function getPeriodStart(todaySAStr: string, startDay: number): string {
  const [y, m, d] = todaySAStr.split("-").map(Number) as [number, number, number];
  let sy = y, sm = m;
  if (d < startDay) {
    sm -= 1;
    if (sm === 0) { sm = 12; sy -= 1; }
  }
  return `${sy}-${String(sm).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
}
