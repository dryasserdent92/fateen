import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const formData = await req.formData();
  const smsText = formData.get("smsText") as string;
  const image = formData.get("image");
  const hasSmsText = typeof smsText === "string" && smsText.trim().length > 0;
  const hasImage = image instanceof File && image.size > 0;

  if (!hasSmsText && !hasImage) {
    return NextResponse.json({ error: "smsText or image is required" }, { status: 400 });
  }

  const prompt = `استخرج من النص/الصورة التالية المعلومات المطلوبة وأرجع JSON فقط بهذا الشكل بدون أي نص إضافي:
{"store":"اسم المتجر","amount":"المبلغ رقم فقط","date":"التاريخ بصيغة YYYY-MM-DD","category":"التصنيف"}

قواعد مهمة:
- إذا جاء بعد كلمة "من" أو "من محل" أو "من متجر" أو "من مطعم" أو "من كافيه" اسم، فهذا هو اسم المتجر
- المبلغ: أرجع رقم فقط بدون كلمة ريال
- التاريخ: إذا لم يذكر تاريخ أرجع null
- التصنيف: اختر من (مطاعم/قهوة/بنزين/سوبرماركت/تسوق/أخرى)`;

  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: string; data: string };
      }
  > = [];

  if (hasSmsText) {
    content.push({
      type: "text",
      text: `${prompt}\n\nالنص: ${smsText.trim()}`,
    });
  } else {
    content.push({
      type: "text",
      text: `${prompt}\n\nالصورة التالية تحتوي على تفاصيل المصروف، استخرج منها البيانات.`,
    });
  }

  if (hasImage) {
    const file = image as File;
    const mimeType = file.type || "image/jpeg";
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: base64,
      },
    });
  }

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
      messages: [
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error?.message ?? "Anthropic API request failed" },
      { status: response.status },
    );
  }

  const text = data.content?.find((item) => item.type === "text")?.text ?? "";
  console.log("Claude response:", text);
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(clean);
  const today = new Date().toISOString().split("T")[0];
  const normalizedDate =
    typeof parsed.date === "string" && parsed.date.trim() ? parsed.date : today;
  const amount = parseFloat(parsed.amount?.toString().replace(/[^\d.]/g, "") || "0");

  if (supabaseAdmin) {
    const { error: insertError } = await supabaseAdmin.from("expenses").insert([
      {
        store: parsed.store,
        amount,
        date: normalizedDate,
        category: parsed.category,
      },
    ]);
    console.log("Insert result:", JSON.stringify(insertError));
    if (insertError) console.error("Supabase insert error:", insertError);
  }

  return NextResponse.json({ ...parsed, date: normalizedDate });
}
