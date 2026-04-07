import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Expense = {
  id: number | string;
  store: string | null;
  amount: number | string | null;
  date: string | null;
  category: string | null;
};

function toNumber(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDate(dateText: string | null): string {
  if (!dateText) return "-";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("ar-SA");
}

export default async function ExpensesPage() {
  const { data, error } = await supabase
    .from("expenses")
    .select("id,store,amount,date,category")
    .order("date", { ascending: false });

  const expenses: Expense[] = data ?? [];

  const now = new Date();
  const currentMonthTotal = expenses.reduce((sum, expense) => {
    if (!expense.date) return sum;
    const date = new Date(expense.date);
    if (Number.isNaN(date.getTime())) return sum;
    const isCurrentMonth =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth();
    return isCurrentMonth ? sum + toNumber(expense.amount) : sum;
  }, 0);

  return (
    <main className="min-h-screen bg-[#1D9E75] px-6 py-10 font-sans">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold text-[#1D9E75]">مصاريفي</h1>
            <Link
              href="/"
              className="rounded-xl bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              الرئيسية
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-600">إجمالي الشهر الحالي</p>
          <p className="mt-1 text-3xl font-extrabold text-[#1D9E75]">
            {currentMonthTotal.toFixed(2)} ر.س
          </p>
          {error ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              تعذر تحميل المصاريف.
            </p>
          ) : null}
        </header>

        <section className="space-y-4">
          {expenses.length === 0 ? (
            <div className="rounded-2xl bg-white p-5 text-center text-gray-600 shadow">
              لا توجد مصاريف حتى الآن.
            </div>
          ) : (
            expenses.map((expense) => (
              <article key={expense.id} className="rounded-2xl bg-white p-5 shadow">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-[#1D9E75]">المتجر:</span>{" "}
                    {expense.store ?? "-"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#1D9E75]">المبلغ:</span>{" "}
                    {toNumber(expense.amount).toFixed(2)} ر.س
                  </p>
                  <p>
                    <span className="font-semibold text-[#1D9E75]">التاريخ:</span>{" "}
                    {formatDate(expense.date)}
                  </p>
                  <p>
                    <span className="font-semibold text-[#1D9E75]">التصنيف:</span>{" "}
                    {expense.category ?? "-"}
                  </p>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
