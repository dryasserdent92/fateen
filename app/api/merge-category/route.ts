import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "../../../lib/auth";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = (await req.json()) as {
    from: string[];   // التصنيفات المراد دمجها
    to: string;       // التصنيف الجديد
  };

  if (!body.from?.length || !body.to?.trim()) {
    return NextResponse.json({ error: "from و to مطلوبان" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  let total = 0;
  const errors: string[] = [];

  for (const fromCat of body.from) {
    const { data, error } = await supabase
      .from("expenses")
      .update({ category: body.to.trim() })
      .eq("user_id", userId)
      .eq("category", fromCat.trim())
      .select("id");

    if (error) {
      errors.push(`${fromCat}: ${error.message}`);
    } else {
      total += data?.length ?? 0;
    }
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" | ") }, { status: 500 });
  }

  return NextResponse.json({ updated: total, to: body.to.trim() });
}
