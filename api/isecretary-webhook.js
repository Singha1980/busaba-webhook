/*************************************************
 * ISECRETARY WEBHOOK
 * ใช้เฉพาะ LINE OA iSecretary
 *************************************************/

function normalizeText(text) {
  if (!text) return "";
  return text.toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function compactText(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("isecretary webhook ready");
  }

  try {
    const events = req.body?.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (!event.message) continue;
      if (event.message.type !== "text") continue;

      const text = String(event.message.text || "").trim();
      const userId = event.source?.userId || "";

      console.log("ISECRETARY TEXT:", text);
      console.log("ISECRETARY USER:", userId);

      const replyText = await handleISecretaryCommand(text, userId);

      console.log("ISECRETARY REPLY:", replyText);

      await replyLineMessage(
        event.replyToken,
        replyText,
        String(process.env.LINE_ACCESS_TOKEN_ISECRETARY || "").trim()
      );
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("ISECRETARY webhook error:", error);
    return res.status(200).send("OK");
  }
}

/* =========================================================
 * ISECRETARY MAIN
 * ========================================================= */

async function handleISecretaryCommand(text, userId) {
  const compact = compactText(text);

  // ------------------------------
  // งานจาก TASKS
  // ------------------------------
  if (
    compact.includes("งานวันนี้") ||
    compact.includes("วันนี้มีงานอะไร") ||
    compact.includes("มีงานอะไรวันนี้")
  ) {
    return await fetchISecretaryReport("today_tasks");
  }

  if (compact.includes("งานค้าง")) {
    return await fetchISecretaryReport("overdue_tasks");
  }

  if (compact.includes("สรุปวันนี้")) {
    return await fetchISecretaryReport("today_summary");
  }

  if (compact.includes("ด่วน")) {
    return await fetchISecretaryReport("urgent_tasks");
  }

  if (compact.includes("สถานะงาน")) {
    return await fetchISecretaryReport("task_status_summary");
  }

  // ------------------------------
  // นัดหมายจาก APPOINTMENTS
  // ตอบจากชีตเท่านั้น ห้ามปล่อยไป GPT
  // ------------------------------
  if (
    compact === "มีนัดไหม" ||
    compact === "วันนี้มีนัดไหม" ||
    compact === "มีนัดไหมวันนี้" ||
    compact === "วันนี้มีนัด" ||
    compact === "มีนัดวันนี้" ||
    compact === "วันนี้มีนัดกี่โมง" ||
    compact === "วันนี้มีนัดเวลาอะไร" ||
    compact === "วันนี้มีนัดที่ไหน"
  ) {
    await saveSecretaryState(userId, {
      intent: "appointment_query_today",
      domain: "",
      date: "",
      time: "",
      detail: "",
      location: "",
      note: "",
      missing_fields: [],
      priority: "NORMAL"
    });
    return await fetchISecretaryReport("today_appointments");
  }

  if (
    compact === "พรุ่งนี้มีนัดไหม" ||
    compact === "มีนัดไหมพรุ่งนี้" ||
    compact === "พรุ่งนี้มีนัด" ||
    compact === "มีนัดพรุ่งนี้" ||
    compact === "พรุ่งนี้มีนัดกี่โมง" ||
    compact === "พรุ่งนี้มีนัดเวลาอะไร" ||
    compact === "พรุ่งนี้มีนัดที่ไหน"
  ) {
    await saveSecretaryState(userId, {
      intent: "appointment_query_tomorrow",
      domain: "",
      date: "",
      time: "",
      detail: "",
      location: "",
      note: "",
      missing_fields: [],
      priority: "NORMAL"
    });
    return await fetchISecretaryReport("tomorrow_appointments");
  }

  if (
    compact.includes("พรุ่งนี้ว่างไหม") ||
    compact.includes("วันพรุ่งนี้ว่างไหม")
  ) {
    return await fetchISecretaryReport("free_tomorrow");
  }

  if (
    compact.includes("วันนี้มีนัดชนกันไหม") ||
    compact.includes("มีนัดชนกันไหมวันนี้")
  ) {
    return await fetchISecretaryReport("clash_today");
  }

  if (
    compact.includes("พรุ่งนี้มีนัดชนกันไหม") ||
    compact.includes("มีนัดชนกันไหมพรุ่งนี้")
  ) {
    return await fetchISecretaryReport("clash_tomorrow");
  }

  // ------------------------------
  // follow-up นัด
  // ------------------------------
  if (
    compact === "กี่โมง" ||
    compact === "เวลาอะไร" ||
    compact === "ที่ไหน" ||
    compact === "นัดที่ไหน" ||
    compact === "เรื่องอะไร"
  ) {
    const state = await getSecretaryState(userId);

    if (state && state.intent === "appointment_query_today") {
      return await fetchISecretaryReport("today_appointments");
    }

    if (state && state.intent === "appointment_query_tomorrow") {
      return await fetchISecretaryReport("tomorrow_appointments");
    }
  }

  // ------------------------------
  // correction
  // ------------------------------
  if (
    compact.includes("ไม่ใช่") ||
    compact.includes("ไม่ได้นัด") ||
    compact.includes("ไม่มีนัด") ||
    compact.includes("ผิด") ||
    compact.includes("เช็กใหม่") ||
    compact.includes("เช็คใหม่") ||
    compact.includes("มั่ว")
  ) {
    const state = await getSecretaryState(userId);

    if (state && state.intent === "appointment_query_today") {
      return "ขออภัยค่ะ คุณสิงห์\nเดี๋ยวไอซ์ตรวจสอบใหม่จากระบบให้นะคะ\n\n" +
        await fetchISecretaryReport("today_appointments");
    }

    if (state && state.intent === "appointment_query_tomorrow") {
      return "ขออภัยค่ะ คุณสิงห์\nเดี๋ยวไอซ์ตรวจสอบใหม่จากระบบให้นะคะ\n\n" +
        await fetchISecretaryReport("tomorrow_appointments");
    }
  }

  // ------------------------------
  // ส่วนล่างค่อยเข้า GPT
  // ------------------------------
  const state = await getSecretaryState(userId);

  if (state) {
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

      if (!savedDirect.ok) {
        return "บันทึกไม่สำเร็จค่ะ คุณสิงห์: " + (savedDirect.message || "unknown error");
      }

      await clearSecretaryState(userId);
      return buildSaveSuccessText(savedDirect, mergedDirect);
    }

    const followupParsed = await parseWithGPT(text);
    followupParsed.domain = inferDomainFromTextAndParsed(text, followupParsed, state.domain || "");
    followupParsed.priority = inferPriority(text, followupParsed);

    const merged = await mergeSecretaryState(userId, followupParsed, text);

    if (!merged.ok) {
      return "ไอซ์รวมข้อมูลต่อไม่สำเร็จค่ะ คุณสิงห์";
    }

    if (!merged.merged.domain) {
      await saveSecretaryState(userId, {
        ...merged.merged,
        missing_fields: ["domain"]
      });
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

    if (!saved.ok) {
      return "บันทึกไม่สำเร็จค่ะ คุณสิงห์: " + (saved.message || "unknown error");
    }

    await clearSecretaryState(userId);
    return buildSaveSuccessText(saved, merged.merged);
  }

  const parsed = await parseWithGPT(text);
  parsed.domain = inferDomainFromTextAndParsed(text, parsed, "");
  parsed.priority = inferPriority(text, parsed);

  if (!parsed.intent) {
    return "ไอซ์ยังตีความไม่สำเร็จค่ะ ลองพิมพ์ใหม่อีกนิดนะคะ คุณสิงห์";
  }

  if (parsed.intent === "chat") {
    return await buildChatReply(text);
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
`;

    const body = {
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ]
    };

    if (
      model.includes("gpt-4o") ||
      model.includes("gpt-4.1") ||
      model.includes("gpt-5")
    ) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
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

async function buildChatReply(text) {
  try {
    const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

    const prompt = `
คุณคือ "ไอซ์" เลขาส่วนตัวของ "คุณสิงห์"
ตอบกระชับ สุภาพ และห้ามอ้างข้อมูลที่ไม่มีในระบบ
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

  if (all.includes("สมาคม") || all.includes("นักธุรกิจ")) return "สมาคมนักธุรกิจ";
  if (all.includes("เทศบาล") || all.includes("เขาชีจรรย์") || all.includes("ชุมชน")) return "เทศบาลเขาชีจรรย์";
  if (all.includes("ร้านป้าย") || all.includes("ป้าย") || all.includes("ลูกค้า") || all.includes("ติดตั้ง") || all.includes("ผลิต")) return "ร้านป้าย";

  return String(fallbackDomain || "").trim();
}

function mapShortDomainAnswer(text) {
  const t = compactText(text);
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

  const response = await fetch(url, { method: "GET", redirect: "follow" });
  const raw = await response.text();

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

  return await response.json();
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

async function replyLineMessage(replyToken, text, accessToken) {
  if (!accessToken) {
    console.error("Missing LINE_ACCESS_TOKEN_ISECRETARY");
    return;
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
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
  console.log("ISECRETARY LINE REPLY STATUS:", response.status);
  console.log("ISECRETARY LINE REPLY BODY:", body);
}
