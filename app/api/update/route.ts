import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "../../../lib/auth";

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = (await req.json()) as {
    id: number | string;
    store?: string | null;
    amount?: number | null;
    date?: string | null;
    category?: string | null;
    item_name?: string | null;
    item_brand?: string | null;
    items?: Array<{ name: string; brand: string | null; quantity: number; unit_price: number; total_price: number }> | null;
  };

  if (!body.id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const updates: Record<string, unknown> = {};
  if (body.store      !== undefined) updates.store      = body.store;
  if (body.amount     !== undefined) updates.amount     = body.amount;
  if (body.date       !== undefined) updates.date       = body.date;
  if (body.category   !== undefined) updates.category   = body.category;
  if (body.item_name  !== undefined) updates.item_name  = body.item_name;
  if (body.item_brand !== undefined) updates.item_brand = body.item_brand;
  if (body.items      !== undefined) updates.items      = body.items;

  const { error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
