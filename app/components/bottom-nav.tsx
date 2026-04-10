"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/",         icon: "🏠", label: "الرئيسية" },
  { href: "/expenses", icon: "🧾", label: "المصاريف" },
  { href: "/add",      icon: null,  label: "إضافة"    }, /* زر الإضافة المركزي */
  { href: "/reports",  icon: "📊", label: "التقارير"  },
  { href: "/settings", icon: "⚙️", label: "الإعدادات" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.07)]">
      {/* pb يأخذ زر الرئيسية في iPhone X+ بعين الاعتبار */}
      <div className="mx-auto flex max-w-xl items-end justify-around px-2 pt-1 bottom-nav-ios" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}>
        {NAV_ITEMS.map((item) => {
          /* زر الإضافة المركزي */
          if (item.icon === null) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 -mt-5"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-[#1D9E75] text-3xl text-white shadow-lg shadow-[#1D9E75]/40 transition-transform active:scale-95">
                  +
                </span>
                <span className="text-[10px] font-bold text-[#1D9E75]">{item.label}</span>
              </Link>
            );
          }

          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 transition-opacity ${
                isActive ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
            >
              <span className={`text-2xl leading-none transition-transform ${isActive ? "scale-110" : ""}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-bold ${isActive ? "text-[#1D9E75]" : "text-gray-500"}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="h-1 w-1 rounded-full bg-[#1D9E75]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
