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
    item_name?: string | null;
    item_brand?: string | null;
    items?: unknown[] | null;
    expenses?: Array<{
      store?: string | null;
      amount?: number;
      date?: string;
      category?: string;
      item_name?: string | null;
      item_brand?: string | null;
      items?: unknown[] | null;
    }>;
  };

  const payloadExpenses =
    Array.isArray(body.expenses) && body.expenses.length > 0
      ? body.expenses
      : [body];

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

  let rows: Array<Record<string, unknown>>;
  try {
    rows = payloadExpenses.map((expense) => {
      const { store, amount, date, category, item_name, item_brand, items } = expense;
      if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
        throw new Error("INVALID_AMOUNT");
      }
      return {
        store: store ?? null,
        amount,
        date: date ?? new Date().toISOString().split("T")[0],
        category: category ?? "أخرى",
        item_name: item_name ?? null,
        item_brand: item_brand ?? null,
        items: items ?? null,
        user_id: userId,
      };
    });
  } catch {
    return NextResponse.json({ error: "مبلغ غير صحيح" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("expenses").insert(rows);

  if (insertError) {
    console.error("Supabase insert error:", insertError);
    return NextResponse.json({ error: "فشل الحفظ في قاعدة البيانات" }, { status: 502 });
  }

  return NextResponse.json({ success: true, count: rows.length });
}
