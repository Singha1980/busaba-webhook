/*************************************************
 * BUSABA + ISECRETARY WEBHOOK
 * FULL REPLACE VERSION
 *************************************************/

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Busaba webhook ready");
  }

  try {
    const events = req.body?.events || [];
    const destination = String(req.body?.destination || "");

    for (const event of events) {
      if (event.type !== "message") continue;
      if (!event.message) continue;
      if (event.message.type !== "text") continue;

      const text = String(event.message.text || "").trim();
      const userId = event.source?.userId || "";

      console.log("LINE TEXT:", text);
      console.log("LINE USER:", userId);
      console.log("LINE DESTINATION:", destination);

      const botType = detectBotType(text, destination);

      let replyText = "";
      if (botType === "ISECRETARY") {
        replyText = await handleISecretaryCommand(text, userId);
      } else {
        replyText = await handleBusabaCommand(text, userId);
      }

      console.log("FINAL REPLY:", replyText);

      const accessToken = getAccessTokenByBotType(botType);
      await reply(event.replyToken, replyText, accessToken);
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).send("OK");
  }
}

/* =========================================================
 * ROUTER
 * ========================================================= */

function detectBotType(text, destination) {
  const mapped = getBotTypeByDestination(destination);
  if (mapped) return mapped;

  if (isISecretaryCommandText(text)) {
    return "ISECRETARY";
  }

  return "BUSABA";
}

function getBotTypeByDestination(destination) {
  if (!destination) return "";

  // ถ้ามี destination ของ OA แต่ละตัวในอนาคต ค่อย map เพิ่มตรงนี้
  // if (destination === "xxxxxxxx") return "BUSABA";
  // if (destination === "yyyyyyyy") return "ISECRETARY";

  return "";
}

function isISecretaryCommandText(text) {
  const cmd = normalizeText(text);

  if (cmd.includes("งานวันนี้")) return true;
  if (cmd.includes("งานค้าง")) return true;
  if (cmd.includes("สรุปวันนี้")) return true;
  if (cmd.includes("พรุ่งนี้มีนัดไหม")) return true;
  if (cmd.includes("พรุ่งนี้มีนัดมั้ย")) return true;
  if (cmd.includes("ด่วน")) return true;
  if (cmd.includes("สถานะงาน")) return true;

  // ข้อความธรรมชาติอื่น ๆ ให้ iSecretary รับต่อได้
  return true;
}

function getAccessTokenByBotType(botType) {
  if (botType === "ISECRETARY") {
    return String(process.env.LINE_ACCESS_TOKEN_ISECRETARY || "").trim();
  }
  return String(process.env.LINE_ACCESS_TOKEN || "").trim();
}

function normalizeText(text) {
  return String(text || "").trim().replace(/\s+/g, "");
}

/* =========================================================
 * BUSABA
 * ========================================================= */

async function handleBusabaCommand(text, userId) {
  const lower = String(text || "").trim().toLowerCase();

  if (text === "เมนู" || lower === "menu") {
    return [
      "BUSABA SIGN SYSTEM",
      "",
      "คำสั่งที่ใช้ได้",
      "- เมนู",
      "- เปิดงาน",
      "- dashboard",
      "",
      "คำนวณราคา เช่น",
      "- ไวนิล 100x200",
      "- คอมโพสิต 120x240",
      "- อะคริลิค 50x100"
    ].join("\n");
  }

  if (text === "เปิดงาน") {
    return `กรอกข้อมูลเปิดงานใหม่ได้ที่นี่ครับ\n${process.env.BUSABA_FORM_URL || "ยังไม่ได้ตั้งค่า BUSABA_FORM_URL"}`;
  }

  if (lower === "dashboard") {
    return `ดู Dashboard ได้ที่\n${process.env.BUSABA_DASHBOARD_URL || "ยังไม่ได้ตั้งค่า BUSABA_DASHBOARD_URL"}`;
  }

  const priceResult = await calculatePriceFromSheet(text, userId);
  if (priceResult) {
    if (!priceResult.ok) return priceResult.message;

    return [
      "ประเมินราคางานเบื้องต้น",
      "",
      "ประเภทลูกค้า: " + priceResult.customerType,
      "ประเภทงาน: " + priceResult.itemName,
      "ขนาด: " + priceResult.widthCm + "x" + priceResult.heightCm + " ซม.",
      "พื้นที่: " + priceResult.areaSqM.toFixed(2) + " ตร.ม.",
      "ราคา: " + priceResult.price.toLocaleString() + " บาท"
    ].join("\n");
  }

  return [
    "BUSABA SIGN SYSTEM",
    "",
    "พิมพ์คำสั่งได้ เช่น",
    "- เมนู",
    "- เปิดงาน",
    "- dashboard",
    "",
    "คำนวณราคา เช่น",
    "- ไวนิล 100x200",
    "- คอมโพสิต 120x240",
    "- อะคริลิค 50x100"
  ].join("\n");
}

/* =========================================================
 * ISECRETARY
 * ========================================================= */

async function handleISecretaryCommand(text, userId) {
  const cmd = normalizeText(text);

  if (cmd.includes("งานวันนี้")) return await fetchISecretaryReport("today_tasks");
  if (cmd.includes("งานค้าง")) return await fetchISecretaryReport("overdue_tasks");
  if (cmd.includes("สรุปวันนี้")) return await fetchISecretaryReport("today_summary");
  if (cmd.includes("พรุ่งนี้มีนัดไหม") || cmd.includes("พรุ่งนี้มีนัดมั้ย")) {
    return await fetchISecretaryReport("tomorrow_appointments");
  }
  if (cmd.includes("ด่วน")) return await fetchISecretaryReport("urgent_tasks");
  if (cmd.includes("สถานะงาน")) return await fetchISecretaryReport("task_status_summary");

  // มี state ค้างอยู่ไหม
  const state = await getSecretaryState(userId);

  if (state) {
    console.log("FOUND STATE:", JSON.stringify(state));

    const followupParsed = await parseWithGPT(text);
    console.log("FOLLOWUP PARSED:", JSON.stringify(followupParsed));

    const merged = await mergeSecretaryState(userId, followupParsed, text);
    console.log("MERGED STATE RESULT:", JSON.stringify(merged));

    if (!merged.ok) {
      return "ไอซ์รวมข้อมูลต่อไม่สำเร็จค่ะ";
    }

    if (merged.missing_fields && merged.missing_fields.length > 0) {
      await saveSecretaryState(userId, merged.merged);
      return buildFollowupText(merged.missing_fields);
    }

    const saved = await saveSecretaryRecord({
      ...merged.merged,
      user_id: userId,
      raw_text: text
    });

    console.log("SAVE RESULT (STATE FLOW):", JSON.stringify(saved));

    if (!saved.ok) {
      return "บันทึกไม่สำเร็จค่ะ: " + (saved.message || "unknown error");
    }

    await clearSecretaryState(userId);
    return buildSaveSuccessText(saved, merged.merged);
  }

  // parse ใหม่
  const parsed = await parseWithGPT(text);
  console.log("PARSED OBJECT:", JSON.stringify(parsed));

  if (!parsed.intent) {
    return "ไอซ์ยังตีความไม่สำเร็จค่ะ ลองพิมพ์ใหม่อีกนิดนะคะ";
  }

  if (parsed.intent === "chat") {
    return parsed.reply_text || "รับทราบค่ะ";
  }

  if (parsed.intent === "search_web") {
    return await searchWebFromApi(parsed.detail || text);
  }

  const missingFields = Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [];

  if (missingFields.length > 0) {
    await saveSecretaryState(userId, parsed);
    return buildFollowupText(missingFields);
  }

  const saved = await saveSecretaryRecord({
    ...parsed,
    user_id: userId,
    raw_text: text
  });

  console.log("SAVE RESULT:", JSON.stringify(saved));

  if (!saved.ok) {
    return "บันทึกไม่สำเร็จค่ะ: " + (saved.message || "unknown error");
  }

  return buildSaveSuccessText(saved, parsed);
}

/* =========================================================
 * GPT MINI PARSER
 * ========================================================= */

async function parseWithGPT(text) {
  try {
    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

    const now = new Date();
    const todayISO = formatDateLocalISO(now);
    const tomorrowISO = formatDateLocalISO(addDays(now, 1));
    const yesterdayISO = formatDateLocalISO(addDays(now, -1));

    const systemPrompt = `
วันนี้คือ ${todayISO}

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
- "วันนี้" = ${todayISO}
- "พรุ่งนี้" = ${tomorrowISO}
- "เมื่อวาน" = ${yesterdayISO}
- date ต้องเป็น YYYY-MM-DD
- time ต้องเป็น HH:MM ถ้าระบุเวลาได้
- ถ้าไม่แน่ใจให้ใส่ ""
- ถ้าข้อมูลไม่ครบให้ใส่ชื่อ field ใน missing_fields
- missing_fields ต้องเป็น array เสมอ
- ถ้าเป็น chat ให้ใส่ reply_text
- ถ้าเป็น search_web ให้ใส่ detail เป็นคำค้น
- ถ้าข้อความมีคำว่า ประชุม นัด เจอ คุย เข้าพบ ดูหน้างาน ให้พิจารณาเป็น appointment ก่อน
- ถ้าข้อความมีคำว่า เตือน ฝากงาน โทรตาม ส่งของ เช็กแบบ ทำป้าย ให้พิจารณาเป็น task ก่อน

ตัวอย่างที่ถูก:
{
  "intent":"appointment",
  "domain":"เทศบาลเขาชีจรรย์",
  "date":"${tomorrowISO}",
  "time":"14:00",
  "detail":"ประชุมเทศบาล",
  "location":"ห้องประชุมใหญ่",
  "note":"",
  "missing_fields":[],
  "reply_text":""
}
`;

    const body = {
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: text
        }
      ]
    };

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
    console.error("parseWithGPT error:", err);

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

  try {
    return JSON.parse(content);
  } catch (err) {}

  try {
    const cleaned = String(content)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {}

  try {
    const str = String(content);
    const start = str.indexOf("{");
    const end = str.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(str.slice(start, end + 1));
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

/* =========================================================
 * APPS SCRIPT API
 * ========================================================= */

async function fetchISecretaryReport(reportType) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();

  if (!apiBase) {
    return "ยังไม่ได้ตั้งค่า ISECRETARY_REPORT_API_URL";
  }

  const joinChar = apiBase.includes("?") ? "&" : "?";
  const url = `${apiBase}${joinChar}report=${encodeURIComponent(reportType)}`;

  console.log("FETCH REPORT URL:", url);

  const response = await fetch(url, { method: "GET", redirect: "follow" });
  const raw = await response.text();
  console.log("FETCH REPORT RAW:", raw);

  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return "ไม่สามารถอ่านข้อมูลรายงานได้";
  }

  if (!data.ok) return data.message || "ไม่พบข้อมูลรายงาน";
  return data.text || "ไม่พบข้อความรายงาน";
}

async function getSecretaryState(userId) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();
  const joinChar = apiBase.includes("?") ? "&" : "?";
  const url = `${apiBase}${joinChar}action=get-state&user_id=${encodeURIComponent(userId)}`;

  const response = await fetch(url, { method: "GET", redirect: "follow" });
  const data = await response.json();

  if (!data.ok) return null;
  return data.state || null;
}

async function saveSecretaryState(userId, payload) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save-state",
      user_id: userId,
      payload
    })
  });

  return await response.json();
}

async function mergeSecretaryState(userId, payload, rawText) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "merge-state",
      user_id: userId,
      payload,
      raw_text: rawText
    })
  });

  return await response.json();
}

async function clearSecretaryState(userId) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "clear-state",
      user_id: userId
    })
  });

  return await response.json();
}

async function saveSecretaryRecord(payload) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save-record",
      payload
    })
  });

  const data = await response.json();
  console.log("SAVE RECORD RESPONSE:", JSON.stringify(data));
  return data;
}

/* =========================================================
 * TEXT BUILDERS
 * ========================================================= */

function buildFollowupText(missingFields) {
  const map = {
    intent: "ประเภท",
    date: "วันที่",
    time: "เวลา",
    detail: "รายละเอียด",
    location: "สถานที่"
  };

  const lines = ["ไอซ์ขอข้อมูลเพิ่มอีกนิดค่ะ", ""];
  missingFields.forEach(f => lines.push("- " + (map[f] || f)));
  return lines.join("\n");
}

function buildSaveSuccessText(saved, parsed) {
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

  if (saved && saved.is_lottery_day) {
    lines.push("");
    lines.push("หมายเหตุเพิ่มเติม: วันดังกล่าวตรงกับวันหวยออก");
  }

  return lines.join("\n");
}

/* =========================================================
 * SEARCH WEB
 * ========================================================= */

async function searchWebFromApi(query) {
  return "กำลังค้นข้อมูลให้ค่ะ: " + query;
}

/* =========================================================
 * PRICE
 * ========================================================= */

async function calculatePriceFromSheet(text, userId) {
  const apiBase = process.env.BUSABA_PRICE_API_URL;
  if (!apiBase) {
    return {
      ok: false,
      message: "ยังไม่ได้ตั้งค่า BUSABA_PRICE_API_URL"
    };
  }

  const size = extractSize(text);
  if (!size) return null;

  const joinChar = apiBase.includes("?") ? "&" : "?";
  const apiUrl = `${apiBase}${joinChar}line_id=${encodeURIComponent(userId)}`;
  const data = await fetchPriceData(apiUrl);

  if (!data || !data.ok) {
    return {
      ok: false,
      message: "ไม่สามารถอ่านข้อมูลราคาจากระบบได้"
    };
  }

  const matchedRule = (data.rules || []).find(rule => {
    return String(rule.active || "").toUpperCase() === "TRUE" &&
           text.includes(String(rule.keyword || "").trim());
  });

  if (!matchedRule) return null;

  const item = (data.catalog || []).find(c => {
    return String(c.item_code || "").trim() === String(matchedRule.item_code || "").trim();
  });

  if (!item) {
    return {
      ok: false,
      message: "พบประเภทงาน แต่ไม่พบข้อมูลราคาใน PRICE_CATALOG"
    };
  }

  const customerType = String(data.customer_type || "ลูกค้าทั่วไป").trim();
  const isPartner = customerType === "ลูกค้าหลังบ้าน";

  const pricePerSqM = isPartner
    ? Number(item.price_partner || 0)
    : Number(item.price_general || 0);

  const minPrice = isPartner
    ? Number(item.min_price_partner || 0)
    : Number(item.min_price_general || 0);

  const areaSqM = (size.widthCm * size.heightCm) / 10000;
  let price = areaSqM * pricePerSqM;
  if (price < minPrice) price = minPrice;

  return {
    ok: true,
    customerType,
    itemName: item.item_name,
    widthCm: size.widthCm,
    heightCm: size.heightCm,
    areaSqM,
    price: Math.round(price)
  };
}

function extractSize(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;

  return {
    widthCm: Number(m[1]),
    heightCm: Number(m[2])
  };
}

async function fetchPriceData(apiUrl) {
  try {
    const response = await fetch(apiUrl, { method: "GET" });
    const rawText = await response.text();
    if (!response.ok) return null;
    return JSON.parse(rawText);
  } catch (error) {
    return null;
  }
}

/* =========================================================
 * DATE HELPERS
 * ========================================================= */

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateLocalISO(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* =========================================================
 * LINE REPLY
 * ========================================================= */

async function reply(replyToken, text, accessToken) {
  const finalToken = String(accessToken || "").trim();
  if (!finalToken) {
    console.error("Missing LINE access token");
    return;
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${finalToken}`
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
