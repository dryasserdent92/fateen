// إعدادات المستخدم المحفوظة في localStorage

export type CustomCategory = { name: string; icon: string };

export interface UserSettings {
  startDay: number;          // يوم بداية الشهر (1-28)، افتراضي 1
  budget: number;            // الميزانية الشهرية (0 = غير محددة)
  customCategories: CustomCategory[];  // تصنيفات مخصصة أضافها المستخدم
}

const KEY = "fateen_settings";

const DEFAULTS: UserSettings = { startDay: 1, budget: 0, customCategories: [] };

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      startDay: typeof parsed.startDay === "number" && parsed.startDay >= 1 && parsed.startDay <= 28
        ? parsed.startDay : 1,
      budget: typeof parsed.budget === "number" && parsed.budget >= 0 ? parsed.budget : 0,
      customCategories: Array.isArray(parsed.customCategories)
        ? (parsed.customCategories as CustomCategory[]).filter(c => c && typeof c.name === "string" && c.name.trim())
        : [],
    };
  } catch { return { ...DEFAULTS }; }
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

/**
 * يحسب مفتاح الدورة المالية لتاريخ معيّن.
 *
 * المنطق: الدورة تبدأ يوم startDay وتُنسب للشهر الذي تنتهي فيه.
 * مثال startDay=27:
 *   - 2026-06-28 → دورة يوليو (بدأت 27 يونيو) → "2026-07"
 *   - 2026-06-15 → دورة يونيو  (بدأت 27 مايو)  → "2026-06"
 *   - 2026-07-26 → دورة يوليو (لم تبدأ دورة أغسطس بعد) → "2026-07"
 *
 * startDay=1 → نفس الشهر الميلادي (توافقي مع السلوك القديم)
 */
export function getCycleKey(dateStr: string, startDay: number): string {
  if (!dateStr || dateStr === "غير محدد") return "غير محدد";
  if (startDay <= 1) return dateStr.slice(0, 7);
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  if (d >= startDay) {
    // المصروف بعد بداية الدورة → ينتمي للشهر القادم
    let nm = m + 1, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    return `${ny}-${String(nm).padStart(2, "0")}`;
  }
  // المصروف قبل بداية الدورة → ينتمي لهذا الشهر
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * يحسب تاريخَي بداية ونهاية الدورة المالية من مفتاح الدورة.
 * مثال: cycleKey="2026-07", startDay=27
 *   → { start: "2026-06-27", end: "2026-07-26" }
 */
export function getCycleRange(cycleKey: string, startDay: number): { start: string; end: string } {
  if (startDay <= 1 || !cycleKey || cycleKey === "غير محدد") {
    // الشهر الميلادي العادي
    const [y, m] = (cycleKey ?? "").split("-").map(Number) as [number, number];
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` };
  }
  const [cy, cm] = cycleKey.split("-").map(Number) as [number, number];
  // بداية الدورة: الشهر السابق يوم startDay
  let sm = cm - 1, sy = cy;
  if (sm === 0) { sm = 12; sy--; }
  const startStr = `${sy}-${String(sm).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
  // نهاية الدورة: هذا الشهر يوم startDay-1
  const endStr = `${cy}-${String(cm).padStart(2, "0")}-${String(startDay - 1).padStart(2, "0")}`;
  return { start: startStr, end: endStr };
}
