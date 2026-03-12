/*************************************************
 BUSABA + ISECRETARY WEBHOOK
 DEBUG VERSION
*************************************************/

const SYSTEM_PROMPT = `
คุณคือเลขาส่วนตัวชื่อ iSecretary
ให้ตอบเป็น JSON object เท่านั้น
ห้ามตอบเป็นข้อความธรรมดา
ห้ามใช้ markdown
ห้ามใช้ code block

intent ต้องเป็นหนึ่งใน:
task
appointment
search_web
chat

domain ต้องเป็นหนึ่งใน:
สมาคมนักธุรกิจ
เทศบาลเขาชีจรรย์
ร้านป้าย
หรือ ""

ต้องมี keys ต่อไปนี้เสมอ:
intent
domain
date
time
detail
location
note
missing_fields
reply_text

กติกา:
- ถ้าไม่แน่ใจให้ใส่ ""
- ถ้าข้อมูลไม่ครบให้ใส่ชื่อ field ใน missing_fields
- missing_fields ต้องเป็น array
- ถ้าเป็น chat ให้ใส่ reply_text
- ถ้าเป็น search_web ให้ใส่ detail เป็นคำค้น
- date พยายามแปลงเป็น YYYY-MM-DD
- time พยายามแปลงเป็น HH:MM

ตัวอย่าง:
{
  "intent":"appointment",
  "domain":"สมาคมนักธุรกิจ",
  "date":"2026-03-13",
  "time":"14:00",
  "detail":"ประชุมสมาคม",
  "location":"ร้านกาแฟ",
  "note":"",
  "missing_fields":[],
  "reply_text":""
}
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Busaba webhook ready");
  }

  try {
    const events = req.body?.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message?.type !== "text") continue;

      const text = String(event.message.text || "").trim();
      const userId = event.source?.userId || "";

      console.log("LINE TEXT:", text);
      console.log("LINE USER:", userId);

      const replyText = await routeMessage(text, userId);

      console.log("FINAL REPLY:", replyText);

      await reply(event.replyToken, replyText);
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).send("OK");
  }
}

/*************************************************
 ROUTER
*************************************************/

async function routeMessage(text, userId) {
  const cmd = normalize(text);

  if (cmd.includes("งานวันนี้")) return await fetchReport("today_tasks");
  if (cmd.includes("งานค้าง")) return await fetchReport("overdue_tasks");
  if (cmd.includes("สรุปวันนี้")) return await fetchReport("today_summary");
  if (cmd.includes("พรุ่งนี้มีนัดไหม")) return await fetchReport("tomorrow_appointments");
  if (cmd.includes("พรุ่งนี้มีนัดมั้ย")) return await fetchReport("tomorrow_appointments");
  if (cmd.includes("ด่วน")) return await fetchReport("urgent_tasks");
  if (cmd.includes("สถานะงาน")) return await fetchReport("task_status_summary");

  const parsed = await parseWithGPT(text);

  console.log("PARSED OBJECT:", JSON.stringify(parsed));

  if (!parsed.intent) {
    return "ไอซ์ยังตีความไม่สำเร็จค่ะ ลองพิมพ์ใหม่อีกนิดนะคะ";
  }

  if (parsed.intent === "chat") {
    return parsed.reply_text || "รับทราบค่ะ";
  }

  if (parsed.intent === "search_web") {
    return "กำลังค้นข้อมูลให้ค่ะ: " + (parsed.detail || text);
  }

  const missing = Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [];

  if (missing.length > 0) {
    return buildFollowupText(missing);
  }

  const saved = await saveRecord({
    ...parsed,
    user_id: userId,
    raw_text: text
  });

  console.log("SAVE RESULT:", JSON.stringify(saved));

  return buildSaveText(saved, parsed);
}

/*************************************************
 GPT PARSER
*************************************************/

async function parseWithGPT(text) {
  try {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const body = {
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: text
        }
      ]
    };

    // ใส่ response_format เฉพาะรุ่นที่มักรองรับ
    if (
      model.includes("gpt-4o") ||
      model.includes("gpt-4.1") ||
      model.includes("gpt-5")
    ) {
      body.response_format = { type: "json_object" };
    }

    console.log("OPENAI MODEL:", model);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log("OPENAI RESPONSE:", JSON.stringify(data));

    const content = data?.choices?.[0]?.message?.content || "";

    console.log("GPT RAW CONTENT:", content);

    const parsed = parseJsonSafely(content);

    return normalizeParsedObject(parsed);
  } catch (err) {
    console.error("GPT parse error:", err);

    return {
      intent: "",
      domain: "",
      date: "",
      time: "",
      detail: "",
      location: "",
      note: "",
      missing_fields: [],
      reply_text: ""
    };
  }
}

function parseJsonSafely(content) {
  if (!content) return {};

  // 1) ตรง ๆ
  try {
    return JSON.parse(content);
  } catch (err) {}

  // 2) ลบ code fence
  try {
    const cleaned = String(content)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {}

  // 3) ดึงเฉพาะช่วง {...}
  try {
    const str = String(content);
    const start = str.indexOf("{");
    const end = str.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const sliced = str.slice(start, end + 1);
      return JSON.parse(sliced);
    }
  } catch (err) {}

  return {};
}

function normalizeParsedObject(parsed) {
  return {
    intent: String(parsed?.intent || "").trim(),
    domain: String(parsed?.domain || "").trim(),
    date: String(parsed?.date || "").trim(),
    time: String(parsed?.time || "").trim(),
    detail: String(parsed?.detail || "").trim(),
    location: String(parsed?.location || "").trim(),
    note: String(parsed?.note || "").trim(),
    missing_fields: Array.isArray(parsed?.missing_fields) ? parsed.missing_fields : [],
    reply_text: String(parsed?.reply_text || "").trim()
  };
}

/*************************************************
 SAVE RECORD
*************************************************/

async function saveRecord(obj) {
  const api = process.env.ISECRETARY_REPORT_API_URL;

  const response = await fetch(api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "save-record",
      payload: obj
    })
  });

  const data = await response.json();
  console.log("SAVE RECORD RESPONSE:", JSON.stringify(data));
  return data;
}

/*************************************************
 REPORTS
*************************************************/

async function fetchReport(type) {
  const api = process.env.ISECRETARY_REPORT_API_URL;
  const url = `${api}?report=${type}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.ok) return "ไม่พบข้อมูลรายงาน";
  return data.text;
}

/*************************************************
 TEXT BUILDERS
*************************************************/

function buildFollowupText(fields) {
  const map = {
    date: "วันที่",
    time: "เวลา",
    detail: "รายละเอียด",
    location: "สถานที่"
  };

  const lines = ["ไอซ์ขอข้อมูลเพิ่มอีกนิดค่ะ", ""];
  fields.forEach(f => lines.push("- " + (map[f] || f)));
  return lines.join("\n");
}

function buildSaveText(saved, parsed) {
  const lines = [
    "บันทึกเรียบร้อยแล้วค่ะ",
    "",
    "ประเภท: " + (parsed.intent === "appointment" ? "นัดหมาย" : "งาน"),
    "หมวดงาน: " + (parsed.domain || "-"),
    "วันที่: " + (parsed.date || "-"),
    "เวลา: " + (parsed.time || "-"),
    "รายละเอียด: " + (parsed.detail || "-"),
    "สถานที่: " + (parsed.location || "-"),
    "หมายเหตุ: " + (parsed.note || "-")
  ];

  if (saved?.is_lottery_day) {
    lines.push("");
    lines.push("หมายเหตุเพิ่มเติม: วันดังกล่าวตรงกับวันหวยออก");
  }

  return lines.join("\n");
}

/*************************************************
 UTIL
*************************************************/

function normalize(t) {
  return String(t || "")
    .trim()
    .replace(/\s+/g, "");
}

/*************************************************
 LINE REPLY
*************************************************/

async function reply(replyToken, text) {
  const token = process.env.LINE_ACCESS_TOKEN_ISECRETARY;

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text: String(text || "").slice(0, 5000)
        }
      ]
    })
  });

  const body = await response.text();
  console.log("LINE REPLY STATUS:", response.status);
  console.log("LINE REPLY BODY:", body);
}
