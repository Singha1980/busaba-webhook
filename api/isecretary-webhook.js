/*************************************************
 * ISECRETARY WEBHOOK
 * SAFE MODE:
 * - ขึ้นต้นด้วย "นัด" = appointment
 * - ไม่ขึ้นต้นด้วย "นัด" = ไม่ลง APPOINTMENTS
 * - งานป้ายต้องเปิดผ่าน Form Busaba เท่านั้น
 *************************************************/

function normalizeText(text) {
  if (!text) return "";
  return text.toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function compactText(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "");
}

function startsWithAppointmentKeyword(text) {
  const raw = String(text || "").trim();
  return raw.startsWith("นัด");
}

function containsWeekdayQuery(text) {
  const compact = compactText(text);

  const keywords = [
    "วันนี้",
    "พรุ่งนี้",
    "มะรืน",
    "วันจันทร์",
    "วันอังคาร",
    "วันพุธ",
    "วันพฤหัส",
    "วันศุกร์",
    "วันเสาร์",
    "วันอาทิตย์",
    "อาทิตย์นี้",
    "อาทิตย์หน้า",
    "สัปดาห์นี้",
    "สัปดาห์หน้า"
  ];

  return keywords.some(k => compact.includes(k));
}
/* =========================================================
 * INTENT ROUTER
 * ========================================================= */

function detectISecretaryIntent(text) {
  const compact = compactText(text);
  const raw = String(text || "").trim();

  // ------------------------------
  // นัดหมาย: ต้องขึ้นต้นด้วย "นัด" เท่านั้น
  // ------------------------------
  if (startsWithAppointmentKeyword(raw)) {
    return "appointment_save";
  }

  // ------------------------------
  // รายงานงานจาก TASKS
  // ------------------------------
  if (
    compact.includes("งานวันนี้") ||
    compact.includes("วันนี้มีงานอะไร") ||
    compact.includes("มีงานอะไรวันนี้") ||
    compact.includes("วันนี้มีงานกี่งาน") ||
    compact.includes("งานวันนี้กี่งาน") ||
    compact.includes("วันนี้ต้องทำอะไร") ||
    compact.includes("วันนี้มีอะไรต้องทำ") ||
    compact.includes("มีอะไรต้องทำวันนี้") ||
    compact.includes("วันนี้มีงานไหม")
  ) {
    return "today_tasks";
  }

  if (
    compact.includes("งานค้าง") ||
    compact.includes("มีงานค้างไหม") ||
    compact.includes("งานค้างกี่งาน") ||
    compact.includes("งานค้างเหลือกี่งาน") ||
    compact.includes("งานที่ยังไม่เสร็จ") ||
    compact.includes("มีงานที่ยังไม่เสร็จไหม")
  ) {
    return "overdue_tasks";
  }

  if (
    compact.includes("งานด่วน") ||
    compact.includes("งานใกล้กำหนด") ||
    compact.includes("งานใกล้ส่ง") ||
    compact.includes("มีงานด่วนไหม")
  ) {
    return "urgent_tasks";
  }

  if (
    compact.includes("สถานะงาน") ||
    compact.includes("สรุปสถานะงาน") ||
    compact.includes("งานตอนนี้เป็นยังไงบ้าง")
  ) {
    return "task_status_summary";
  }

  if (
    compact.includes("สรุปวันนี้") ||
    compact.includes("วันนี้สรุปอะไรบ้าง")
  ) {
    return "today_summary";
  }

  // ------------------------------
  // ถามนัดหมาย / เช็กว่าง / เช็กคิว
  // ------------------------------
  if (
    compact === "มีนัดไหม" ||
    compact === "วันนี้มีนัดไหม" ||
    compact === "มีนัดไหมวันนี้" ||
    compact === "วันนี้มีนัด" ||
    compact === "มีนัดวันนี้" ||
    compact === "วันนี้มีนัดกี่โมง" ||
    compact === "วันนี้มีนัดเวลาอะไร" ||
    compact === "วันนี้มีนัดที่ไหน" ||
    compact === "วันนี้ว่างไหม"
  ) {
    return "today_appointments";
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
    return "tomorrow_appointments";
  }

  if (
    compact.includes("พรุ่งนี้ว่างไหม") ||
    compact.includes("วันพรุ่งนี้ว่างไหม")
  ) {
    return "free_tomorrow";
  }

  if (
    compact.includes("วันนี้มีนัดชนกันไหม") ||
    compact.includes("มีนัดชนกันไหมวันนี้")
  ) {
    return "clash_today";
  }

  if (
    compact.includes("พรุ่งนี้มีนัดชนกันไหม") ||
    compact.includes("มีนัดชนกันไหมพรุ่งนี้")
  ) {
    return "clash_tomorrow";
  }

  // ------------------------------
  // ใหม่: ถ้ามีคำวัน + คำถามนัด/ว่าง/คิว/มีอะไรบ้าง
  // ------------------------------
  if (
    containsWeekdayQuery(raw) &&
    (
      compact.includes("นัด") ||
      compact.includes("ว่าง") ||
      compact.includes("คิว") ||
      compact.includes("มีอะไรบ้าง")
    )
  ) {
    return "custom_appointments_query";
  }

  if (
    compact === "กี่โมง" ||
    compact === "เวลาอะไร" ||
    compact === "ที่ไหน" ||
    compact === "นัดที่ไหน" ||
    compact === "เรื่องอะไร"
  ) {
    return "appointment_followup";
  }

  if (
    compact.includes("ไม่ใช่") ||
    compact.includes("ไม่ได้นัด") ||
    compact.includes("ไม่มีนัด") ||
    compact.includes("ผิด") ||
    compact.includes("เช็กใหม่") ||
    compact.includes("เช็คใหม่") ||
    compact.includes("มั่ว")
  ) {
    return "appointment_recheck";
  }

  return "general_note";
}
/* =========================================================
 * SAFE PARSER FOR APPOINTMENT
 * ========================================================= */

function parseAppointmentSafely(text) {
  const raw = String(text || "").trim();

  // ตัดคำว่า "นัด" ด้านหน้าออกเพื่อนำไปเป็น detail
  const withoutPrefix = raw.replace(/^นัด\s*/i, "").trim();

  const parsed = {
    intent: "appointment",
    domain: detectDomainFromText(withoutPrefix),
    date: parseDateFromThaiText(withoutPrefix),
    time: parseTimeFromThaiText(withoutPrefix),
    detail: withoutPrefix || raw,
    location: parseLocationFromThaiText(withoutPrefix),
    note: "",
    missing_fields: [],
    reply_text: ""
  };

  // ถ้าไม่มีเวลาชัดเจน ยังให้ถามต่อ
  if (!parsed.date) parsed.missing_fields.push("date");
  if (!parsed.time) parsed.missing_fields.push("time");

  return parsed;
}

function detectDomainFromText(text) {
  const t = String(text || "");

  if (t.includes("เทศบาล")) return "เทศบาลเขาชีจรรย์";
  if (t.includes("สมาคม")) return "สมาคมนักธุรกิจ";
  if (t.includes("ร้านป้าย") || t.includes("ป้าย")) return "ร้านป้าย";
  if (t.includes("ส่งงาน")) return "นัดส่งงาน";
  if (t.includes("ดูงาน") || t.includes("ดูหน้างาน")) return "นัดดูงาน";
  if (t.includes("ลูกค้า")) return "นัดลูกค้า";
  if (t.includes("ติดตั้ง")) return "นัดติดตั้ง";

  return "";
}

function parseDateFromThaiText(text) {
  const now = new Date();

  if (/พรุ่งนี้/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return formatDateLocalISO(d);
  }

  if (/มะรืน/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return formatDateLocalISO(d);
  }

  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dmMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dmMatch) {
    const day = String(dmMatch[1]).padStart(2, "0");
    const month = String(dmMatch[2]).padStart(2, "0");
    const year = normalizeThaiYear(dmMatch[3], now.getFullYear());
    return `${year}-${month}-${day}`;
  }

  const weekdayWithDay = text.match(/วัน(?:จันทร์|อังคาร|พุธ|พฤหัส(?:บดี)?|ศุกร์|เสาร์|อาทิตย์)\s*(?:ที่)?\s*(\d{1,2})/);
  if (weekdayWithDay) {
    const d = nextDateWithDay(Number(weekdayWithDay[1]), now);
    return d ? formatDateLocalISO(d) : "";
  }

  const weekdays = {
    "วันอาทิตย์": 0, "วันจันทร์": 1, "วันอังคาร": 2, "วันพุธ": 3,
    "วันพฤหัสบดี": 4, "วันพฤหัส": 4, "วันศุกร์": 5, "วันเสาร์": 6
  };
  for (const [word, weekday] of Object.entries(weekdays)) {
    if (text.includes(word)) {
      const d = new Date(now);
      d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
      return formatDateLocalISO(d);
    }
  }

  return "";
}

function normalizeThaiYear(value, fallbackYear) {
  if (!value) return String(fallbackYear);
  let year = Number(value);
  if (value.length === 2) year += year >= 50 ? 2500 : 2000;
  if (year > 2400) year -= 543;
  return String(year);
}

function nextDateWithDay(day, now) {
  if (day < 1 || day > 31) return null;
  for (let monthOffset = 0; monthOffset < 13; monthOffset++) {
    const candidate = new Date(now.getFullYear(), now.getMonth() + monthOffset, day);
    if (candidate.getDate() === day && candidate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return candidate;
  }
  return null;
}

function parseLocationFromThaiText(text) {
  const match = String(text || "").match(/(?:ที่|ณ)\s*([^\d,，]+)$/i);
  return match ? match[1].trim() : "";
}

function parseAppointmentFollowup(text, state) {
  const raw = String(text || "").trim();
  const parsed = {
    intent: "appointment",
    domain: detectDomainFromText(raw),
    date: parseDateFromThaiText(raw),
    time: parseTimeFromThaiText(raw),
    detail: "",
    location: parseLocationFromThaiText(raw),
    note: "",
    priority: state.priority || "NORMAL"
  };
  const expected = Array.isArray(state.missing_fields) ? state.missing_fields[0] : "";
  if (expected === "detail" && !parsed.date && !parsed.time) parsed.detail = raw;
  if (expected === "location" && !parsed.location) parsed.location = raw;
  return parsed;
}

function mergeAppointmentState(state, parsed) {
  return {
    intent: "appointment",
    domain: parsed.domain || state.domain || "",
    date: parsed.date || state.date || "",
    time: parsed.time || state.time || "",
    detail: parsed.detail || state.detail || "",
    location: parsed.location || state.location || "",
    note: parsed.note || state.note || "",
    priority: parsed.priority || state.priority || "NORMAL",
    missing_fields: []
  };
}

function appointmentMissingFields(parsed) {
  const missing = [];
  if (!parsed.date) missing.push("date");
  if (!parsed.time) missing.push("time");
  if (!parsed.detail) missing.push("detail");
  return missing;
}

function isCancelCommand(text) {
  return /^(ยกเลิก|ไม่เอาแล้ว|เริ่มใหม่)$/i.test(String(text || "").trim());
}

function isConfirmCommand(text) {
  return /^(ยืนยัน|ตกลง|โอเค|ok|ใช่|ถูกต้อง)$/i.test(String(text || "").trim());
}

function parseTimeFromThaiText(text) {
  const hm = text.match(/(\d{1,2})[:.](\d{2})/);
  if (hm) {
    return String(hm[1]).padStart(2, "0") + ":" + hm[2];
  }

  const onlyHour = text.match(/(\d{1,2})\s*โมง/);
  if (onlyHour) {
    return String(onlyHour[1]).padStart(2, "0") + ":00";
  }

  return "";
}

/* =========================================================
 * WEBHOOK HANDLER
 * ========================================================= */

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
 * MAIN COMMAND
 * ========================================================= */

async function handleISecretaryCommand(text, userId) {
  const currentState = await getSecretaryState(userId);

  if (isCancelCommand(text) && currentState) {
    await clearSecretaryState(userId);
    return "ยกเลิกข้อมูลที่กำลังกรอกแล้วค่ะ คุณสิงห์";
  }

  if (currentState && currentState.intent === "task_close_confirmation") {
    if (!isConfirmCommand(text)) {
      return [
        "กำลังรอยืนยันปิดงาน " + currentState.domain,
        "พิมพ์ “ยืนยัน” เพื่อปิดงาน",
        "หรือพิมพ์ “ยกเลิก”"
      ].join("\n");
    }

    const closed = await closeTask(currentState.domain, userId);
    if (!closed.ok) return closed.message || "ปิดงานไม่สำเร็จค่ะ คุณสิงห์";
    await clearSecretaryState(userId);
    return buildTaskClosedText(closed);
  }

  const closeMatch = String(text || "").trim().match(/^(?:จบ|ปิดงาน)\s+(.+)$/i);
  if (closeMatch) {
    const found = await findOpenTask(closeMatch[1]);
    if (!found.ok) return found.message || "ไม่พบงานที่ต้องการปิดค่ะ คุณสิงห์";

    await saveSecretaryState(userId, {
      intent: "task_close_confirmation",
      domain: found.task.task_id,
      date: "",
      time: "",
      detail: found.task.customer_name + " | " + found.task.job_detail,
      location: "",
      note: found.task.required_date || "",
      missing_fields: ["confirm"],
      priority: "NORMAL"
    });
    return buildTaskCloseConfirmationText(found.task);
  }

  if (currentState && currentState.intent === "appointment") {
    const pending = Array.isArray(currentState.missing_fields) ? currentState.missing_fields : [];

    if (pending[0] === "confirm") {
      if (isConfirmCommand(text)) {
        const saved = await saveSecretaryRecord({
          ...currentState,
          user_id: userId,
          raw_text: currentState.detail,
          missing_fields: []
        });
        if (!saved.ok) return "บันทึกนัดหมายไม่สำเร็จค่ะ คุณสิงห์";
        await clearSecretaryState(userId);
        return buildSaveSuccessText(saved, currentState);
      }

      const edited = mergeAppointmentState(currentState, parseAppointmentFollowup(text, currentState));
      const editedMissing = appointmentMissingFields(edited);
      edited.missing_fields = editedMissing.length ? editedMissing : ["confirm"];
      await saveSecretaryState(userId, edited);
      return editedMissing.length ? buildFollowupText(editedMissing) : buildConfirmationText(edited);
    }

    const merged = mergeAppointmentState(currentState, parseAppointmentFollowup(text, currentState));
    const missing = appointmentMissingFields(merged);
    merged.missing_fields = missing.length ? missing : ["confirm"];
    await saveSecretaryState(userId, merged);
    return missing.length ? buildFollowupText(missing) : buildConfirmationText(merged);
  }

  const intent = detectISecretaryIntent(text);

  if (intent === "today_tasks") {
    return await fetchISecretaryReport("today_tasks");
  }

  if (intent === "overdue_tasks") {
    return await fetchISecretaryReport("overdue_tasks");
  }

  if (intent === "urgent_tasks") {
    return await fetchISecretaryReport("urgent_tasks");
  }

  if (intent === "task_status_summary") {
    return await fetchISecretaryReport("task_status_summary");
  }

  if (intent === "today_summary") {
    return await fetchISecretaryReport("today_summary");
  }

  if (intent === "today_appointments") {
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

  if (intent === "tomorrow_appointments") {
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

  if (intent === "free_tomorrow") {
    return await fetchISecretaryReport("free_tomorrow");
  }

  if (intent === "clash_today") {
    return await fetchISecretaryReport("clash_today");
  }

  if (intent === "clash_tomorrow") {
    return await fetchISecretaryReport("clash_tomorrow");
  }

    if (intent === "custom_appointments_query") {

  const raw = String(text || "");

  // 🔹 map ให้ใช้ของเดิมก่อน (ไม่พัง)
  if (raw.includes("วันนี้")) {
    return await fetchISecretaryReport("today_appointments");
  }

  if (raw.includes("พรุ่งนี้")) {
    return await fetchISecretaryReport("tomorrow_appointments");
  }

  // 🔹 วันอื่นยังไม่รองรับ → ตอบแบบฉลาด
  return [
    "ตอนนี้ระบบรองรับเฉพาะ",
    "• วันนี้",
    "• พรุ่งนี้",
    "",
    "ตัวอย่าง:",
    "วันนี้มีนัดไหม",
    "พรุ่งนี้ว่างไหม"
  ].join("\n");
}
  
  if (intent === "appointment_followup") {
    const state = await getSecretaryState(userId);

    if (state && state.intent === "appointment_query_today") {
      return await fetchISecretaryReport("today_appointments");
    }

    if (state && state.intent === "appointment_query_tomorrow") {
      return await fetchISecretaryReport("tomorrow_appointments");
    }
  }

  if (intent === "appointment_recheck") {
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

  if (intent === "appointment_save") {
    let parsed = parseAppointmentSafely(text);

    if (parsed.missing_fields.length > 0) {
      await saveSecretaryState(userId, {
        ...parsed,
        priority: "NORMAL"
      });
      return buildFollowupText(parsed.missing_fields);
    }

    parsed.missing_fields = ["confirm"];
    await saveSecretaryState(userId, { ...parsed, priority: "NORMAL" });
    return buildConfirmationText(parsed);
  }

  // ข้อความทั่วไป = บันทึกโน้ตอย่างเดียว ไม่สร้าง TASKS
  return [
    "รับทราบค่ะ คุณสิงห์",
    "",
    "หากต้องการบันทึกนัดหมาย",
    "กรุณาพิมพ์ขึ้นต้นด้วยคำว่า “นัด”",
    "",
    "ตัวอย่าง:",
    "นัด พรุ่งนี้ 10 โมง ประชุมเทศบาล",
    "",
    "หากต้องการเปิดงานร้านป้าย",
    "กรุณากรอกผ่านฟอร์ม Busaba"
  ].join("\n");
}

/* =========================================================
 * APPS SCRIPT API
 * ========================================================= */

async function fetchISecretaryReport(reportType, extraPayload = null) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();
  if (!apiBase) {
    return "ยังไม่ได้ตั้งค่า ISECRETARY_REPORT_API_URL ค่ะ คุณสิงห์";
  }

  // เคสธรรมดา ใช้ GET เหมือนเดิม
  if (!extraPayload) {
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

  // เคส custom query ใช้ POST
  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "report-query",
      report: reportType,
      payload: extraPayload
    })
  });

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

async function findOpenTask(taskRef) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();
  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "find-open-task", task_ref: taskRef })
  });
  return await response.json();
}

async function closeTask(taskId, userId) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();
  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "close-task", task_id: taskId, user_id: userId })
  });
  return await response.json();
}

/* =========================================================
 * TEXT BUILDERS
 * ========================================================= */

function buildFollowupText(missingFields) {
  const map = {
    date: "วันที่",
    time: "เวลา",
    detail: "รายละเอียด",
    location: "สถานที่"
  };

  const field = missingFields[0];
  const examples = {
    date: "วันที่เท่าไรคะ? เช่น 24/08/69 หรือ พรุ่งนี้",
    time: "กี่โมงคะ? เช่น 09:00 หรือ 9 โมง",
    detail: "นัดทำอะไรคะ?",
    location: "นัดที่ไหนคะ?"
  };
  return examples[field] || ("ขอ" + (map[field] || field) + "เพิ่มอีกนิดค่ะ");
}

function buildConfirmationText(parsed) {
  return [
    "ขอสรุปนัดหมายค่ะ",
    "วันที่: " + parsed.date,
    "เวลา: " + parsed.time,
    "เรื่อง: " + parsed.detail,
    parsed.location ? "สถานที่: " + parsed.location : "",
    "",
    "ถ้าถูกต้อง พิมพ์ “ยืนยัน”",
    "หากต้องการแก้ พิมพ์วันที่หรือเวลาใหม่ได้เลย",
    "หรือพิมพ์ “ยกเลิก”"
  ].filter(Boolean).join("\n");
}

function buildTaskCloseConfirmationText(task) {
  return [
    "ต้องการปิดงานนี้ใช่ไหมคะ?",
    "",
    "🧾 " + task.task_id,
    "👤 " + (task.customer_name || "-"),
    "📌 " + (task.job_detail || "-"),
    "⚙️ " + (task.production_status || task.status || "-"),
    "📅 ส่ง " + (task.required_date || "-"),
    "",
    "พิมพ์ “ยืนยัน” เพื่อปิดงาน",
    "หรือพิมพ์ “ยกเลิก”"
  ].join("\n");
}

function buildTaskClosedText(result) {
  const task = result.task || {};
  return [
    "✅ ปิดงานเรียบร้อยแล้วค่ะ",
    "งาน: " + (task.task_id || "-"),
    "ลูกค้า: " + (task.customer_name || "-"),
    "สถานะ: เสร็จแล้ว",
    "ปิดเมื่อ: " + (result.closed_at || "-")
  ].join("\n");
}

function buildSaveSuccessText(saved, parsed) {
  const isAppointment = parsed.intent === "appointment";

  const lines = [];

  if (isAppointment) {
    lines.push("บันทึกนัดหมายเรียบร้อยแล้วค่ะ คุณสิงห์");
  } else {
    lines.push("บันทึกเป็นโน้ตเรียบร้อยแล้วค่ะ คุณสิงห์");
  }

  lines.push("");
  lines.push("ประเภท: " + (isAppointment ? "นัดหมาย" : "โน้ต"));
  lines.push("หมวดงาน: " + (parsed.domain || "-"));
  lines.push("วันที่: " + (parsed.date || "-"));
  lines.push("เวลา: " + (parsed.time || "-"));
  lines.push("รายละเอียด: " + (parsed.detail || "-"));
  lines.push("สถานที่: " + (parsed.location || "-"));
  lines.push("หมายเหตุ: -");

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
