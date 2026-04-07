import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const formData = await req.formData();
  const smsText = formData.get("smsText") as string;
  if (!smsText || !smsText.trim()) {
    return NextResponse.json({ error: "smsText is required" }, { status: 400 });
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
          content: `استخرج من هذا النص: اسم المتجر، المبلغ، التاريخ، والتصنيف (مطاعم/قهوة/بنزين/سوبرماركت/تسوق/أخرى). أرجع JSON فقط بهذا الشكل: {"store":"","amount":"","date":"","category":""}. يجب أن يكون التاريخ بصيغة YYYY-MM-DD فقط بدون أي صيغة أخرى. النص: ${smsText}`,
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
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(clean);
  const amount = parseFloat(parsed.amount?.toString().replace(/[^\d.]/g, "") || "0");

  const { error: insertError } = await supabaseAdmin.from("expenses").insert([
    {
      store: parsed.store,
      amount,
      date: parsed.date,
      category: parsed.category,
    },
  ]);
  console.log("Insert result:", JSON.stringify(insertError));

  if (insertError) {
    console.error("Supabase insert error:", insertError);
  }

  return NextResponse.json(parsed);
}
