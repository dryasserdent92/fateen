/**
 * عند التشغيل في Capacitor (iOS/Android)، يُستخدم NEXT_PUBLIC_API_URL
 * كعنوان Vercel الأساسي حتى تصل طلبات /api إلى الخادم الصحيح.
 * عند التشغيل على الويب أو في بيئة التطوير يبقى فارغاً.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** تُعيد المسار كاملاً — مطلق في Capacitor، نسبي في الويب */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
