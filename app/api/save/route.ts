import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  /* استخراج بيانات المصروف من الطلب */
  const body = (await req.json()) as {
    store?: string | null;
    amount?: number;
    date?: string;
    category?: string;
  };

  const { store, amount, date, category } = body;

  if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "مبلغ غير صحيح" }, { status: 400 });
  }

  /* محاولة ربط المصروف بالمستخدم الحالي إن وجد */
  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabaseAuth = createClient(supabaseUrl, serviceKey);
    const { data } = await supabaseAuth.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { error: insertError } = await supabase.from("expenses").insert({
    store: store ?? null,
    amount,
    date: date ?? new Date().toISOString().split("T")[0],
    category: category ?? "أخرى",
    user_id: userId,
  });

  if (insertError) {
    console.error("Supabase insert error:", insertError);
    return NextResponse.json({ error: "فشل الحفظ في قاعدة البيانات" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
