import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "../../../lib/auth";

type RepeatItemStat = {
  name: string;
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  cheapestStore: string | null;
  stores: string[];
  totalSpent: number;
  potentialSavings: number;
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

  const body = (await req.json()) as { items: RepeatItemStat[] };
  const items = body.items ?? [];

  if (items.length === 0) {
    return NextResponse.json({ advice: "ما عندي بيانات كافية أحللها الحين." });
  }

  // بناء نص ملخص البيانات
  const summaryLines = items.slice(0, 10).map((item, i) => {
    const stores = item.stores.length > 0 ? item.stores.join("، ") : "متاجر متعددة";
    const savings = item.potentialSavings > 0
      ? ` (توفير محتمل: ${item.potentialSavings.toFixed(1)} ر.س لو اشتريته دايماً من الأرخص)`
      : "";
    return `${i + 1}. ${item.name}: اشتريته ${item.count} مرة، متوسط السعر ${item.avgPrice.toFixed(2)} ر.س، أرخص سعر ${item.minPrice.toFixed(2)} ر.س من ${item.cheapestStore ?? "غير محدد"}، المتاجر: ${stores}${savings}`;
  });

  const prompt = `أنت "عمار"، مستشار مالي ذكي وودود متخصص في مساعدة السعوديين على توفير مصاريفهم اليومية. أسلوبك مباشر، عملي، وفيه شوية طرافة سعودية.

بناءً على بيانات مشتريات المستخدم المتكررة التالية، قدّم نصائح ذكية ومحددة:

${summaryLines.join("\n")}

قواعد ردك:
- اكتب 3-5 نصائح عملية ومحددة
- ركّز على الأصناف اللي فيها فرق سعري واضح أو توفير محتمل
- اقترح متجراً محدداً لكل صنف إذا البيانات تدعم ذلك
- اذكر المبلغ الذي يمكن توفيره إذا كان كبيراً
- أسلوب محادثة عربي سعودي خفيف، مباشر، ومفيد
- لا تكرر كل البيانات، فقط أبرز الفرص الذهبية
- الطول المناسب: 4-8 جمل كافية`;

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
        max_tokens: 800,
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

    const advice = data.content?.find((c) => c.type === "text")?.text ?? "";
    return NextResponse.json({ advice });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "فشل الاتصال بعمار" },
      { status: 502 },
    );
  }
}
