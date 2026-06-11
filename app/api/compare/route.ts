import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "../../../lib/auth";

type ItemInput = {
  name: string;
  brand: string | null;
  unit_price: number;
  quantity: number;
  store: string | null;
  date: string | null;
};

type CompareResult = {
  comparable: boolean;
  item1_unit_count: number | null;
  item2_unit_count: number | null;
  item3_unit_count: number | null;
  item1_price_per_unit: number | null;
  item2_price_per_unit: number | null;
  item3_price_per_unit: number | null;
  winner: 1 | 2 | 3 | null;
  savings_percent: number | null;
  unit_label: string | null;
  message: string;
};

function buildItemBlock(item: ItemInput, idx: number): string {
  return `الصنف ${idx === 1 ? "الأول" : idx === 2 ? "الثاني" : "الثالث"}:
- الاسم: ${item.name}${item.brand ? ` (${item.brand})` : ""}
- السعر: ${item.unit_price.toFixed(2)} ريال للعبوة
- العدد المشترى: ${item.quantity} عبوة
- المتجر: ${item.store ?? "غير محدد"}`;
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const body = (await req.json()) as { item1: ItemInput; item2: ItemInput; item3?: ItemInput | null };
  const { item1, item2, item3 } = body;
  const hasThree = !!item3;

  const itemsBlock = [
    buildItemBlock(item1, 1),
    buildItemBlock(item2, 2),
    ...(hasThree ? [buildItemBlock(item3!, 3)] : []),
  ].join("\n\n");

  const winnerNote = hasThree
    ? `"winner": 1 أو 2 أو 3 أو null`
    : `"winner": 1 أو 2 أو null`;

  const item3Fields = hasThree ? `
  "item3_unit_count": رقم أو null,
  "item3_price_per_unit": رقم أو null,` : `
  "item3_unit_count": null,
  "item3_price_per_unit": null,`;

  const prompt = `أنت "عمار" مستشار مالي ذكي وعملي للمستهلك السعودي. مهمتك مقارنة ${hasThree ? "ثلاثة أصناف" : "صنفين"} من مشتريات المستخدم وتحديد الأفضل قيمةً للمال.

${itemsBlock}

المطلوب:
1. حدد إذا كانت المقارنة منطقية (نفس النوع من المنتج — مثلاً حفائظ مقابل حفائظ، عصير مقابل عصير).
2. إذا كانت منطقية: استخرج عدد الوحدات داخل كل عبوة من الاسم (مثل "60 حبة" = 60، "1 لتر" = 1000 مل، "500 غرام" = 500).
3. احسب سعر الوحدة الواحدة لكل صنف.
4. حدد الأفضل قيمةً للمال.
5. احسب نسبة التوفير لو اشترى دايماً الأرخص مقارنةً بالأغلى.

أرجع JSON صحيح فقط — بدون أي نص قبله أو بعده:

{
  "comparable": true أو false,
  "item1_unit_count": رقم أو null,
  "item2_unit_count": رقم أو null,${item3Fields}
  ${winnerNote},
  "savings_percent": رقم أو null,
  "unit_label": "حبة" أو "مل" أو "غرام" أو غيرها أو null,
  "message": "رسالة عمار للمستخدم بالعربي السعودي — إذا comparable=false اكتب رسالة طريفة تقول المقارنة ما تجي — إذا comparable=true اكتب تحليلاً مختصراً يبين الترتيب من الأرخص للأغلى بسعر الوحدة، والتوفير الكلي لو دايماً يشتري الأفضل"
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
        max_tokens: 700,
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
