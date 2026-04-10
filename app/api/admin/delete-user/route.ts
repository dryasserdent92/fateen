import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "../../../../lib/auth";

const ADMIN_EMAILS = ["almunajem.yasser@gmail.com", "dr.yasserdent92@gmail.com"];

export async function DELETE(req: NextRequest) {
  /* ── كلمة المرور ── */
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return NextResponse.json({ error: "ADMIN_PASSWORD غير مضبوط" }, { status: 500 });
  if (req.headers.get("x-admin-password") !== adminPassword) {
    return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 403 });
  }

  /* ── تحقق من هوية الأدمن ── */
  const callerId = await getUserIdFromRequest(req);
  if (!callerId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  const { data: callerData } = await supabase.auth.admin.getUserById(callerId);
  if (!callerData?.user?.email || !ADMIN_EMAILS.includes(callerData.user.email)) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  /* ── المستخدم المراد حذفه ── */
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId");
  if (!targetId) return NextResponse.json({ error: "userId مطلوب" }, { status: 400 });

  /* ── منع حذف نفسه ── */
  if (targetId === callerId) {
    return NextResponse.json({ error: "لا يمكنك حذف حسابك الخاص" }, { status: 400 });
  }

  /* ── حذف مصاريف المستخدم أولاً ── */
  await supabase.from("expenses").delete().eq("user_id", targetId);

  /* ── حذف المستخدم من Auth ── */
  const { error } = await supabase.auth.admin.deleteUser(targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ success: true });
}
