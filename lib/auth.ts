import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

/**
 * يتحقق من JWT في Authorization header
 * ويعيد user_id إذا كان الطلب صحيحاً، أو null إذا لم يكن موثّقاً
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) return null;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const jwt = authHeader.slice(7);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.auth.getUser(jwt);

  if (error || !data.user) return null;
  return data.user.id;
}
