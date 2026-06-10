import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "../../../lib/auth";

type ItemInput = {
  name: string;
  brand: string | null;
  unit_price: number;
  quantity: number; // عدد العبوات المشتراة
  store: string | null;
  date: string | null;
};

type CompareResult = {
  comparable: boolean;
  item1_unit_count: number | null;   // عدد القطع داخل العبوة
  item2_unit_count: number | null;
  item1_price_per_unit: number | null;
  item2_price_per_unit: number | null;
  winner: 1 | 2 | null;             // الأفضل قيمةً
  savings_percent: number | null;    // نسبة التوفير
  unit_label: string | null;         // "حبة" / "مل" / "غرام" ...
  message: string;
};

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const body = (await req.json()) as { item1: ItemInput; item2: ItemInput };
  const { item1, item2 } = body;

  const prompt = `أنت "عمار" مستشار مالي ذكي وعملي للمستهلك السعودي. مهمتك مقارنة صنفين من مشتريات المستخدم وتحديد الأفضل قيمةً للمال.

الصنف الأول:
- الاسم: ${item1.name}${item1.brand ? ` (${item1.brand})` : ""}
- السعر: ${item1.unit_price.toFixed(2)} ريال للعبوة
- العدد المشترى: ${item1.quantity} عبوة
- المتجر: ${item1.store ?? "غير محدد"}

الصنف الثاني:
- الاسم: ${item2.name}${item2.brand ? ` (${item2.brand})` : ""}
- السعر: ${item2.unit_price.toFixed(2)} ريال للعبوة
- العدد المشترى: ${item2.quantity} عبوة
- المتجر: ${item2.store ?? "غير محدد"}

المطلوب:
1. حدد إذا كانت المقارنة منطقية (نفس النوع من المنتج — مثلاً حفائظ مقابل حفائظ، عصير مقابل عصير).
2. إذا كانت منطقية: استخرج عدد الوحدات داخل كل عبوة من الاسم (مثل "60 حبة" = 60، "1 لتر" = 1000 مل، "500 غرام" = 500).
3. احسب سعر الوحدة الواحدة لكل صنف.
4. حدد الأفضل قيمةً للمال.
5. احسب نسبة التوفير لو اشترى دايماً الأرخص.

أرجع JSON صحيح فقط — بدون أي نص قبله أو بعده:

{
  "comparable": true أو false,
  "item1_unit_count": رقم أو null,
  "item2_unit_count": رقم أو null,
  "item1_price_per_unit": رقم أو null,
  "item2_price_per_unit": رقم أو null,
  "winner": 1 أو 2 أو null,
  "savings_percent": رقم أو null,
  "unit_label": "حبة" أو "مل" أو "غرام" أو غيرها أو null,
  "message": "رسالة عمار للمستخدم بالعربي السعودي — إذا comparable=false اكتب رسالة طريفة تقول المقارنة ما تجي مثل: يالحبيب المقارنة هذي ما تجي، شايش تقارن X بـY؟ خلك فطين وقارن نفس النوع — إذا comparable=true اكتب تحليلاً مختصراً ومفيداً يبين الأفضل قيمةً مع ذكر السعر لكل وحدة والمبلغ الموفر لو دايماً يشتري الأرخص"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = (await response.json()) as {
      error?: { message?: string };
      content?: Array<{ type?: string; text?: string }>;
    };

    if (!response.ok) {
      throw new Error(data.error?.message ?? "Anthropic API request failed");
    }

    const raw = data.content?.find((c) => c.type === "text")?.text ?? "";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("لم يرد عمار بشكل صحيح");

    const result = JSON.parse(jsonMatch[0]) as CompareResult;
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "فشل الاتصال بعمار" },
      { status: 502 },
    );
  }
}
