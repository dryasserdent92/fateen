import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "../../../../lib/auth";

/* ── قائمة الإيميلات المسموح لها بالوصول للداشبورد ── */
const ADMIN_EMAILS = ["almunajem.yasser@gmail.com", "dr.yasserdent92@gmail.com"];

export async function GET(req: NextRequest) {
  /* ── تحقق من الهوية ── */
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY!;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  /* ── تحقق أن المستخدم admin ── */
  const { data: callerData } = await supabase.auth.admin.getUserById(userId);
  if (!callerData?.user?.email || !ADMIN_EMAILS.includes(callerData.user.email)) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  /* ── جلب كل المستخدمين من auth ── */
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 502 });

  const users = usersData.users;

  /* ── جلب إحصائيات المصاريف لكل مستخدم ── */
  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("user_id, amount, date, category");

  const expensesByUser: Record<string, { count: number; total: number; lastDate: string; categories: Record<string, number> }> = {};
  for (const row of expenseRows ?? []) {
    const uid = row.user_id as string;
    if (!expensesByUser[uid]) expensesByUser[uid] = { count: 0, total: 0, lastDate: "", categories: {} };
    const u = expensesByUser[uid]!;
    u.count += 1;
    u.total += typeof row.amount === "number" ? row.amount : parseFloat(row.amount ?? "0") || 0;
    if (!u.lastDate || (row.date && row.date > u.lastDate)) u.lastDate = row.date ?? "";
    const cat = (row.category as string) ?? "أخرى";
    u.categories[cat] = (u.categories[cat] ?? 0) + 1;
  }

  /* ── تاريخ اليوم بتوقيت السعودية ── */
  const todayStr  = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  const thisYM    = todayStr.slice(0, 7); /* "2026-04" */
  const lastYM    = (() => {
    const [y, m] = thisYM.split("-").map(Number);
    const d = new Date(y!, m! - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  /* ── إحصائيات عامة ── */
  const totalUsers      = users.length;
  const newThisMonth    = users.filter((u) => u.created_at.slice(0, 7) === thisYM).length;
  const newLastMonth    = users.filter((u) => u.created_at.slice(0, 7) === lastYM).length;
  const activeThisMonth = users.filter((u) => {
    const exp = expensesByUser[u.id];
    return exp && exp.lastDate.slice(0, 7) === thisYM;
  }).length;
  const totalExpenses   = (expenseRows ?? []).length;
  const totalAmount     = Object.values(expensesByUser).reduce((s, u) => s + u.total, 0);

  /* ── نمو المستخدمين — آخر 6 أشهر ── */
  const monthlyGrowth = (() => {
    const result: { ym: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const [y, m] = thisYM.split("-").map(Number);
      const d = new Date(y!, m! - 1, 1);
      d.setMonth(d.getMonth() - i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      result.push({ ym, label: MONTHS[d.getMonth()]!, count: users.filter((u) => u.created_at.slice(0, 7) === ym).length });
    }
    return result;
  })();

  /* ── قائمة المستخدمين مع تفاصيلهم ── */
  const userList = users
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((u) => {
      const meta   = (u.user_metadata ?? {}) as Record<string, string>;
      const exp    = expensesByUser[u.id];
      const isActive = exp ? exp.lastDate.slice(0, 7) === thisYM : false;
      return {
        id:          u.id,
        name:        meta["full_name"] ?? meta["name"] ?? u.email?.split("@")[0] ?? "مجهول",
        email:       u.email ?? "",
        avatar:      meta["avatar_url"] ?? null,
        provider:    (u.app_metadata?.provider as string) ?? "email",
        joinedAt:    u.created_at,
        lastSignIn:  u.last_sign_in_at ?? null,
        expenseCount: exp?.count ?? 0,
        expenseTotal: exp?.total ?? 0,
        lastExpDate:  exp?.lastDate ?? null,
        topCategory:  exp ? Object.entries(exp.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null,
        isActive,
      };
    });

  return NextResponse.json({
    summary: { totalUsers, newThisMonth, newLastMonth, activeThisMonth, totalExpenses, totalAmount },
    monthlyGrowth,
    users: userList,
  });
}
