import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "../../../lib/auth";

export async function DELETE(req: NextRequest) {
  /* ── التحقق من الهوية ── */
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  /* نحذف فقط إذا كان المصروف يخص هذا المستخدم */
  const { error, count } = await supabase
    .from("expenses")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Supabase delete error:", error);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 502 });
  }

  if (count === 0) {
    return NextResponse.json({ error: "المصروف غير موجود أو لا تملك صلاحية حذفه" }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
