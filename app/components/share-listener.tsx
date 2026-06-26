"use client";

/**
 * ShareListener — يستمع لحدث fateenShare الذي يُطلقه AppDelegate
 * عندما يشارك المستخدم رسالة SMS من تطبيق الرسائل إلى فطين
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShareListener() {
  const router = useRouter();

  useEffect(() => {
    function handleShare(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (!text) return;

      // احفظ النص مؤقتاً في sessionStorage
      sessionStorage.setItem("fateenPendingShare", text);

      // انتقل لصفحة الإضافة
      router.push("/add?source=share");
    }

    window.addEventListener("fateenShare", handleShare);
    return () => window.removeEventListener("fateenShare", handleShare);
  }, [router]);

  return null;
}
