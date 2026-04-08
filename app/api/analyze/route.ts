import { NextRequest, NextResponse } from "next/server";

type ParsedExpense = {
  store: string | null;
  amount: string | number | null;
  date: string | null;
  category: string | null;
};

function buildPrompt(inputLabel: string): string {
  return `استخرج من ${inputLabel} المعلومات المطلوبة وأرجع JSON فقط بهذا الشكل بدون أي نص إضافي:
{"store":"اسم المتجر","amount":"المبلغ رقم فقط","date":"التاريخ بصيغة YYYY-MM-DD","category":"التصنيف"}

قواعد مهمة:
- إذا جاء بعد كلمة "من" أو "من محل" أو "من متجر" أو "من مطعم" أو "من كافيه" اسم، فهذا هو اسم المتجر
- المبلغ: أرجع رقم فقط بدون كلمة ريال
- التاريخ: إذا لم يذكر تاريخ أرجع null
- التصنيف: اختر من (مطاعم/قهوة/بنزين/سوبرماركت/تسوق/أخرى)`;
}

function parseClaudeText(text: string): ParsedExpense {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean) as ParsedExpense;
}

function normalizeExpense(parsed: ParsedExpense) {
  const today = new Date().toISOString().split("T")[0];
  const normalizedDate =
    typeof parsed.date === "string" && parsed.date.trim() ? parsed.date : today;
  const amount = parseFloat(parsed.amount?.toString().replace(/[^\d.]/g, "") || "0");

  return {
    store: parsed.store ?? null,
    amount,
    date: normalizedDate,
    category: parsed.category ?? "أخرى",
  };
}

async function callClaude(
  apiKey: string,
  content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      }
    | {
        type: "document";
        source: { type: "base64"; media_type: "application/pdf"; data: string };
      }
  >,
) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content }],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Anthropic API request failed");
  }

  const text = data.content?.find((item) => item.type === "text")?.text ?? "";
  console.log("Claude response:", text);
  return normalizeExpense(parseClaudeText(text));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const formData = await req.formData();
  const files = formData.getAll("image");
  const uploadedFiles = files.filter((item): item is File => item instanceof File && item.size > 0);

  if (uploadedFiles.length === 0) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  const expenses: Array<{ store: string | null; amount: number; date: string; category: string | null }> =
    [];

  try {
    for (const file of uploadedFiles) {
      const mimeType = file.type || "image/jpeg";
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const isPdf = mimeType === "application/pdf";

      const imageExpense = await callClaude(apiKey, [
        {
          type: "text",
          text: isPdf
            ? `${buildPrompt("ملف PDF التالي")}\n\nملف PDF يحتوي تفاصيل مصروف، استخرج البيانات منه.`
            : `${buildPrompt("الصورة التالية")}\n\nالصورة تحتوي تفاصيل مصروف، استخرج البيانات منها.`,
        },
        isPdf
          ? {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: base64,
              },
            }
          : {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: mimeType,
                data: base64,
              },
            },
      ]);
      expenses.push(imageExpense);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Anthropic API request failed" },
      { status: 502 },
    );
  }

  const mergedExpense = {
    store: expenses.map((e) => e.store).filter(Boolean).join(" + ") || null,
    amount: expenses.reduce((sum, e) => sum + e.amount, 0),
    date: expenses[0]?.date ?? new Date().toISOString().split("T")[0],
    category: expenses.length === 1 ? expenses[0]?.category ?? "أخرى" : "أخرى",
  };

  /* تحليل فقط — الحفظ يتم بشكل منفصل عبر /api/save */
  return NextResponse.json({
    expense: expenses[0] ?? mergedExpense,
    expenses,
    mergedExpense,
  });
}
