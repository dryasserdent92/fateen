import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "../../../lib/auth";

type ExpenseItem = {
  name: string;
  brand: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type ParsedExpense = {
  store: string | null;
  amount: string | number | null;
  date: string | null;
  category: string | null;
  item_name: string | null;
  item_brand: string | null;
  items: ExpenseItem[] | null;
};

function buildPrompt(inputLabel: string): string {
  const currentYear = new Date().getFullYear(); // 2026
  return `أنت مساعد متخصص في قراءة الفواتير السعودية. استخرج من ${inputLabel} البيانات وأرجع JSON صحيح فقط — بدون أي نص قبله أو بعده.

السنة الحالية: ${currentYear} — إذا ظهرت سنة مكونة من رقمين مثل "26" فاعتبرها ${currentYear}.

الشكل المطلوب:
{"store":"اسم المتجر","amount":0,"date":"YYYY-MM-DD","category":"التصنيف","item_name":null,"item_brand":null,"items":[{"name":"اسم الصنف","brand":null,"quantity":1,"unit_price":0,"total_price":0}]}

تعليمات دقيقة:

▌ store
- اسم المتجر أو الشركة باللغة الأصلية (عربي أو إنجليزي)
- أمثلة: "ستاربكس"، "العثيم"، "مطعم البيك"، "SACO"، "أرامكو"
- null إذا لم يُذكر اسم

▌ amount
- الإجمالي الشامل للضريبة (ابحث عن: المجموع الكلي / الإجمالي / Total / Grand Total / المبلغ المدفوع)
- رقم عشري فقط بدون رموز — مثال: 47.5 وليس "47.5 ريال"
- إذا وُجد VAT/ضريبة فاجمعها مع الإجمالي قبل الضريبة

▌ date
- صيغة YYYY-MM-DD فقط
- ابحث عن: التاريخ / Date / تاريخ الفاتورة
- null إذا لم يُذكر

▌ category — اختر واحدة فقط:
- "مطاعم" → وجبات، مطاعم، وجبات سريعة، كافيهات بها أكل
- "قهوة" → ستاربكس، كوفي بين، دانكن، قهوة فقط بدون أكل
- "بنزيني" → وقود السيارة الشخصية للمالك نفسه
- "بنزين السواق" → وقود سيارة السواق أو العامل
- "بنزين عام" → محطات الوقود بدون تحديد (أرامكو، أدنوك)
- "سوبرماركت" → العثيم، بن داود، كارفور، لولو، هايبر
- "تسوق" → ملابس، إلكترونيات، مفروشات، أمازون
- "صحة" → صيدليات، مستشفيات، عيادات
- "فواتير" → كهرباء، ماء، إنترنت، جوال، اشتراكات
- "رواتب" → رواتب الخدم، العمالة المنزلية، السواق
- "أخرى" → ما لا ينتمي لما سبق

▌ items — مصفوفة الأصناف:
- أدرج كل صنف مستقل مع اسمه الكامل
- quantity: العدد (رقم صحيح)
- unit_price: سعر الوحدة قبل الضرب
- total_price: quantity × unit_price (احسبها أنت)
- brand: الماركة إذا ذُكرت، وإلا null
- للمشتريات أحادية الصنف (فنجان قهوة واحد، تعبئة بنزين) → items: null وضع التفاصيل في item_name/item_brand

▌ item_name / item_brand
- للصنف الواحد فقط، null إذا items موجودة`;
}

function parseClaudeText(text: string): ParsedExpense {
  // نظّف markdown code blocks
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // استخرج أول كائن JSON بالـ regex — يتجاهل أي نص قبله أو بعده
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`لا يوجد JSON في الرد: ${clean.slice(0, 100)}`);

  // أصلح المسافات البيضاء الزائدة داخل القيم النصية التي تسبب أخطاء parse
  const jsonStr = match[0].replace(/[\u0000-\u001F]/g, (c) =>
    c === "\n" || c === "\r" || c === "\t" ? " " : ""
  );

  return JSON.parse(jsonStr) as ParsedExpense;
}

/* تحويل الأرقام العربية الهندية (٠-٩) إلى أرقام غربية (0-9) */
function toWesternDigits(str: string): string {
  return str.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
  );
}

/** تصحيح التاريخ: يعالج السنة ذات الرقمين والصيغ المختلفة */
function fixDate(raw: string): string {
  if (!raw) return raw;
  const s = raw.trim();

  // صيغة YYYY-MM-DD أو YY-MM-DD (مع شرطات)
  const isoLike = s.match(/^(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (isoLike) {
    const [, p1, p2, p3] = isoLike as [string, string, string, string];
    let y = parseInt(p1), m = parseInt(p2), d = parseInt(p3);
    // إذا كان p1 <= 31 وp3 >= 2000 → الصيغة DD-MM-YYYY
    if (y <= 31 && d >= 2000) { [y, d] = [d, y]; }
    // سنة بـ رقمين
    if (y < 100) y += 2000;
    // تحقق من المنطقية
    if (y >= 2020 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
  }

  // صيغة DD/MM/YY أو DD-MM-YY
  const dmyLike = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (dmyLike) {
    const [, d, m, p3] = dmyLike as [string, string, string, string];
    let y = parseInt(p3);
    if (y < 100) y += 2000;
    const day = parseInt(d), mon = parseInt(m);
    if (y >= 2020 && y <= 2099 && mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(mon).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    }
  }

  return s;
}

function normalizeExpense(parsed: ParsedExpense) {
  const today = new Date().toISOString().split("T")[0]!;
  const rawDate = typeof parsed.date === "string" && parsed.date.trim() ? parsed.date.trim() : today;
  const normalizedDate = fixDate(rawDate);

  // تحقق نهائي: لو السنة خرجت 4 أرقام بدء من 20 فهي صحيحة
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)
    && parseInt(normalizedDate.slice(0,4)) >= 2020
    ? normalizedDate : today;

  const rawAmount = toWesternDigits(parsed.amount?.toString() ?? "")
    .replace(/[^\d.]/g, "");
  const amount = parseFloat(rawAmount || "0");

  return {
    store:      parsed.store ?? null,
    amount,
    date:       validDate,
    category:   parsed.category ?? "أخرى",
    item_name:  parsed.item_name ?? null,
    item_brand: parsed.item_brand ?? null,
    items:      Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : null,
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
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
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
  /* ── التحقق من الهوية ── */
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const formData = await req.formData();
  const smsText = formData.get("smsText") as string | null;
  const files = formData.getAll("image");
  const uploadedFiles = files.filter((item): item is File => item instanceof File && item.size > 0);
  const hasSmsText = typeof smsText === "string" && smsText.trim().length > 0;

  if (!hasSmsText && uploadedFiles.length === 0) {
    return NextResponse.json({ error: "smsText أو image مطلوب" }, { status: 400 });
  }

  const expenses: Array<{ store: string | null; amount: number; date: string; category: string | null }> =
    [];

  try {
    /* تحليل نص SMS أو صوت */
    if (hasSmsText) {
      const textExpense = await callClaude(apiKey, [
        {
          type: "text",
          text: `${buildPrompt("النص التالي")}\n\nالنص: ${smsText!.trim()}`,
        },
      ]);
      expenses.push(textExpense);
    }

    /* تحليل الصور */
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
