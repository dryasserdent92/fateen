import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey || !anonKey) {
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

  /* قراءة المستخدم الحالي من جلسة Supabase عبر cookies */
  let userId: string | null = null;
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Route handlers can ignore cookie set errors in this flow.
        }
      },
    },
  });
  const { data: authData } = await supabaseAuth.auth.getUser();
  userId = authData.user?.id ?? null;

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
