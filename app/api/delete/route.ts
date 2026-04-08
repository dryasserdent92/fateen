import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    console.error("Supabase delete error:", error);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
