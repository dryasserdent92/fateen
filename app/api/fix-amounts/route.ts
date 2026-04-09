import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "../../../lib/auth";

/**
 * DELETE /api/fix-amounts
 * يحذف جميع المصاريف المحفوظة بمبلغ صفر لهذا المستخدم.
 * يُستدعى مرة واحدة من الإعدادات.
 */
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { count, error } = await supabase
    .from("expenses")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .or("amount.is.null,amount.eq.0");

  if (error) {
    return NextResponse.json({ error: "فشل التنظيف" }, { status: 502 });
  }

  return NextResponse.json({ success: true, deleted: count ?? 0 });
}
