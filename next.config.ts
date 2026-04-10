import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(self), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

// عند البناء لـ Capacitor (iOS/Android)، نُصدر تطبيقاً ثابتاً
const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: "export",      // يُنتج مجلد out/ ثابت
    trailingSlash: true,   // ضروري لعمل الروابط في Capacitor
    images: { unoptimized: true }, // الصور لا تحتاج خادم
  }),
  async headers() {
    // الـ headers لا تعمل في الـ static export
    if (isCapacitorBuild) return [];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
