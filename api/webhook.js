/*************************************************
 * BUSABA + ISECRETARY WEBHOOK
 * V3.1 NO WEB SEARCH
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
  if (isISecretaryCommandText(text)) return "ISECRETARY";
  return "BUSABA";
}

function getBotTypeByDestination(destination) {
  if (!destination) return "";
  return "";
}

function isISecretaryCommandText(text) {
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

  // รายงาน
  if (cmd.includes("งานวันนี้")) return await fetchISecretaryReport("today_tasks");
  if (cmd.includes("งานค้าง")) return await fetchISecretaryReport("overdue_tasks");
  if (cmd.includes("สรุปวันนี้")) return await fetchISecretaryReport("today_summary");
  if (cmd.includes("พรุ่งนี้มีนัดไหม") || cmd.includes("พรุ่งนี้มีนัดมั้ย")) {
    return await fetchISecretaryReport("tomorrow_appointments");
  }
  if (cmd.includes("ด่วน")) return await fetchISecretaryReport("urgent_tasks");
  if (cmd.includes("สถานะงาน")) return await fetchISecretaryReport("task_status_summary");

  // ถ้ามี state ค้างอยู่ ให้จัดการก่อนทุกอย่าง
  const state = await getSecretaryState(userId);

  if (state) {
    console.log("FOUND STATE:", JSON.stringify(state));

    // ถ้าตอบสั้น ๆ แค่ domain ให้จับตรงนี้เลย
    const directDomain = mapShortDomainAnswer(text);
    if (directDomain) {
      const mergedDirect = {
        ...state,
        domain: directDomain
      };

      const missingAfterDirect = computeMissingFieldsLocal(mergedDirect);

      if (missingAfterDirect.length > 0) {
        await saveSecretaryState(userId, {
          ...mergedDirect,
          missing_fields: missingAfterDirect
        });
        return buildFollowupText(missingAfterDirect);
      }

      const savedDirect = await saveSecretaryRecord({
        ...mergedDirect,
        user_id: userId,
        raw_text: text,
        priority: inferPriority(text, mergedDirect)
      });

      console.log("SAVE RESULT (DIRECT DOMAIN):", JSON.stringify(savedDirect));

      if (!savedDirect.ok) {
        return "บันทึกไม่สำเร็จค่ะ คุณสิงห์: " + (savedDirect.message || "unknown error");
      }

      await clearSecretaryState(userId);
      return buildSaveSuccessText(savedDirect, mergedDirect);
    }

    const followupParsed = await parseWithGPT(text);
    followupParsed.domain = inferDomainFromTextAndParsed(text, followupParsed, state.domain || "");
    followupParsed.priority = inferPriority(text, followupParsed);
    console.log("FOLLOWUP PARSED:", JSON.stringify(followupParsed));

    const merged = await mergeSecretaryState(userId, followupParsed, text);
    console.log("MERGED STATE RESULT:", JSON.stringify(merged));

    if (!merged.ok) {
      return "ไอซ์รวมข้อมูลต่อไม่สำเร็จค่ะ คุณสิงห์";
    }

    if (!merged.merged.domain) {
      const payloadForState = {
        ...merged.merged,
        missing_fields: ["domain"]
      };
      await saveSecretaryState(userId, payloadForState);
      return buildFollowupText(["domain"]);
    }

    if (merged.missing_fields && merged.missing_fields.length > 0) {
      await saveSecretaryState(userId, {
        ...merged.merged,
        missing_fields: merged.missing_fields
      });
      return buildFollowupText(merged.missing_fields);
    }

    const saved = await saveSecretaryRecord({
      ...merged.merged,
      priority: merged.merged.priority || inferPriority(text, merged.merged),
      user_id: userId,
      raw_text: text
    });

    console.log("SAVE RESULT (STATE FLOW):", JSON.stringify(saved));

    if (!saved.ok) {
      return "บันทึกไม่สำเร็จค่ะ คุณสิงห์: " + (saved.message || "unknown error");
    }

    await clearSecretaryState(userId);
    return buildSaveSuccessText(saved, merged.merged);
  }

  const parsed = await parseWithGPT(text);
  parsed.domain = inferDomainFromTextAndParsed(text, parsed, "");
  parsed.priority = inferPriority(text, parsed);
  console.log("PARSED OBJECT:", JSON.stringify(parsed));

  if (!parsed.intent) {
    return "ไอซ์ยังตีความไม่สำเร็จค่ะ ลองพิมพ์ใหม่อีกนิดนะคะ คุณสิงห์";
  }

  if (parsed.intent === "chat") {
    return await buildChatReply(text, userId);
  }

  const missingFields = Array.isArray(parsed.missing_fields) ? [...parsed.missing_fields] : [];

  if (!parsed.domain && !missingFields.includes("domain")) {
    missingFields.push("domain");
  }

  if (missingFields.length > 0) {
    await saveSecretaryState(userId, {
      ...parsed,
      missing_fields: missingFields
    });
    return buildFollowupText(missingFields);
  }

  const saved = await saveSecretaryRecord({
    ...parsed,
    user_id: userId,
    raw_text: text
  });

  console.log("SAVE RESULT:", JSON.stringify(saved));

  if (!saved.ok) {
    return "บันทึกไม่สำเร็จค่ะ คุณสิงห์: " + (saved.message || "unknown error");
  }

  return buildSaveSuccessText(saved, parsed);
}

/* =========================================================
 * GPT PARSER
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

คุณคือเลขาส่วนตัวชื่อ "ไอซ์"
กำลังดูแลงานของ "คุณสิงห์"

ให้ตอบเป็น JSON object เท่านั้น
ห้ามตอบเป็นข้อความธรรมดา
ห้ามใช้ markdown
ห้ามใช้ code block

intent ต้องเป็นหนึ่งใน:
task
appointment
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
- ถ้าเป็น chat ให้ใส่ reply_text แบบสุภาพ เป็นกันเอง
- ถ้าข้อความมีคำว่า ประชุม นัด เจอ คุย เข้าพบ ดูหน้างาน ให้พิจารณาเป็น appointment ก่อน
- ถ้าข้อความมีคำว่า เตือน ฝากงาน โทรตาม ส่งของ เช็กแบบ ทำป้าย ให้พิจารณาเป็น task ก่อน
- ถ้าเดา domain ไม่ได้ ให้ใส่ ""
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

async function buildChatReply(text, userId) {
  try {
    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

    const prompt = `
คุณคือ "ไอซ์" เลขาส่วนตัวของ "คุณสิงห์"

บุคลิก:
- สุภาพ
- เป็นกันเอง
- ใช้คำลงท้ายว่า "ค่ะ คุณสิงห์" เมื่อเหมาะสม
- คุยเหมือนเลขาส่วนตัวจริง
- ช่วยคิด ช่วยเตือน ช่วยจัดระเบียบงาน
- ตอบกระชับ อ่านง่าย

ห้ามอ้างว่าทำสิ่งที่ระบบยังทำไม่ได้
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text }
        ]
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return String(content || "รับทราบค่ะ คุณสิงห์").trim();
  } catch (err) {
    console.error("buildChatReply error:", err);
    return "รับทราบค่ะ คุณสิงห์";
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
 * DOMAIN + PRIORITY
 * ========================================================= */

function inferDomainFromTextAndParsed(text, parsed, fallbackDomain) {
  const sourceText = String(text || "").toLowerCase();
  const detail = String(parsed?.detail || "").toLowerCase();
  const location = String(parsed?.location || "").toLowerCase();
  const all = [sourceText, detail, location].join(" ");

  if (all.includes("สมาคม") || all.includes("นักธุรกิจ")) {
    return "สมาคมนักธุรกิจ";
  }

  if (all.includes("เทศบาล") || all.includes("เขาชีจรรย์") || all.includes("ชุมชน")) {
    return "เทศบาลเขาชีจรรย์";
  }

  if (
    all.includes("ป้าย") ||
    all.includes("ลูกค้า") ||
    all.includes("ติดตั้ง") ||
    all.includes("ผลิต") ||
    all.includes("ร้านป้าย")
  ) {
    return "ร้านป้าย";
  }

  return String(parsed?.domain || fallbackDomain || "").trim();
}

function mapShortDomainAnswer(text) {
  const t = normalizeText(text);

  if (t === "สมาคม" || t === "สมาคมนักธุรกิจ") return "สมาคมนักธุรกิจ";
  if (t === "เทศบาล" || t === "เทศบาลเขาชีจรรย์" || t === "เขาชีจรรย์") return "เทศบาลเขาชีจรรย์";
  if (t === "ร้านป้าย" || t === "ป้าย") return "ร้านป้าย";

  return "";
}

function inferPriority(text, parsed) {
  const all = [String(text || ""), String(parsed?.detail || ""), String(parsed?.note || "")]
    .join(" ")
    .toLowerCase();

  if (
    all.includes("ด่วน") ||
    all.includes("ด่วนมาก") ||
    all.includes("รีบ") ||
    all.includes("ทันที") ||
    all.includes("urgent")
  ) {
    return "HIGH";
  }

  return "NORMAL";
}

function computeMissingFieldsLocal(obj) {
  const missing = [];

  if (!obj.intent) missing.push("intent");
  if (!obj.detail) missing.push("detail");

  if (obj.intent === "appointment") {
    if (!obj.date) missing.push("date");
    if (!obj.time) missing.push("time");
    if (!obj.location) missing.push("location");
  }

  if (obj.intent === "task") {
    if (!obj.date) missing.push("date");
  }

  if (!obj.domain) missing.push("domain");

  return missing;
}

/* =========================================================
 * APPS SCRIPT API
 * ========================================================= */

async function fetchISecretaryReport(reportType) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();

  if (!apiBase) {
    return "ยังไม่ได้ตั้งค่า ISECRETARY_REPORT_API_URL ค่ะ คุณสิงห์";
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
    return "ไม่สามารถอ่านข้อมูลรายงานได้ค่ะ คุณสิงห์";
  }

  if (!data.ok) return data.message || "ไม่พบข้อมูลรายงานค่ะ คุณสิงห์";
  return data.text || "ไม่พบข้อความรายงานค่ะ คุณสิงห์";
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
    domain: "งานนี้เป็นเรื่อง สมาคม / เทศบาล / ร้านป้าย คะ",
    intent: "ประเภท",
    date: "วันที่",
    time: "เวลา",
    detail: "รายละเอียด",
    location: "สถานที่"
  };

  if (missingFields.length === 1 && missingFields[0] === "domain") {
    return "งานนี้เป็นเรื่อง สมาคม / เทศบาล / ร้านป้าย คะ คุณสิงห์";
  }

  const lines = ["ไอซ์ขอข้อมูลเพิ่มอีกนิดค่ะ คุณสิงห์", ""];
  missingFields.forEach(f => lines.push("- " + (map[f] || f)));
  return lines.join("\n");
}

function buildSaveSuccessText(saved, parsed) {
  const lines = [
    "บันทึกเรียบร้อยแล้วค่ะ คุณสิงห์",
    "",
    "ประเภท: " + (parsed.intent === "appointment" ? "นัดหมาย" : "งาน"),
    "หมวดงาน: " + (parsed.domain || "-"),
    "วันที่: " + (parsed.date || "-"),
    "เวลา: " + (parsed.time || "-"),
    "รายละเอียด: " + (parsed.detail || "-"),
    "สถานที่: " + (parsed.location || "-"),
    "หมายเหตุ: " + (parsed.note || "-")
  ];

  if (parsed.priority === "HIGH") {
    lines.push("ระดับความสำคัญ: ด่วน");
  }

  if (saved && saved.is_lottery_day) {
    lines.push("");
    lines.push("หมายเหตุเพิ่มเติม: วันดังกล่าวตรงกับวันหวยออกค่ะ คุณสิงห์");
  }

  return lines.join("\n");
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
