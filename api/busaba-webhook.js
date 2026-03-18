/*************************************************
 * BUSABA WEBHOOK
 * ใช้สำหรับ LINE OA Busaba
 * - คำสั่งภายในออฟฟิศ
 * - รายงานงาน
 * - คำนวณราคาจากแชท
 *************************************************/

function normalizeText(text) {
  if (!text) return "";
  return String(text).trim().toLowerCase().replace(/\s+/g, " ");
}

function compactText(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "");
}

function detectBusabaCommand(text) {
  const compact = compactText(text);

  if (
    compact === "#งานค้าง" ||
    compact === "งานค้าง" ||
    compact === "#มีงานค้างไหม" ||
    compact === "มีงานค้างไหม"
  ) {
    return "overdue_tasks";
  }

  if (
    compact === "#งานวันนี้" ||
    compact === "งานวันนี้" ||
    compact === "#วันนี้มีงานอะไร" ||
    compact === "วันนี้มีงานอะไร" ||
    compact === "#วันนี้มีงานกี่งาน" ||
    compact === "วันนี้มีงานกี่งาน" ||
    compact === "#งานวันนี้กี่งาน" ||
    compact === "งานวันนี้กี่งาน"
  ) {
    return "today_tasks";
  }

  if (
    compact === "#งานด่วน" ||
    compact === "งานด่วน" ||
    compact === "#มีงานด่วนไหม" ||
    compact === "มีงานด่วนไหม" ||
    compact === "#งานใกล้ส่ง" ||
    compact === "งานใกล้ส่ง"
  ) {
    return "urgent_tasks";
  }

  if (
    compact === "#สถานะงาน" ||
    compact === "สถานะงาน" ||
    compact === "#สรุปสถานะงาน" ||
    compact === "สรุปสถานะงาน"
  ) {
    return "task_status_summary";
  }

  if (
    compact === "#สรุปวันนี้" ||
    compact === "สรุปวันนี้"
  ) {
    return "today_summary";
  }

  if (compact.indexOf("#คำนวณราคา") === 0 || compact.indexOf("คำนวณราคา") === 0) {
    return "price_calc";
  }

  return "";
}

function extractPriceCalcPayload(text) {
  let raw = String(text || "").trim();
  raw = raw.replace(/^#คำนวณราคา\s*/i, "");
  raw = raw.replace(/^คำนวณราคา\s*/i, "");
  raw = raw.trim();

  const sizeMatch = raw.match(/(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/);
  const qtyMatch = raw.match(/(?:^|\s)(\d+)\s*$/);

  let widthCm = 0;
  let heightCm = 0;
  let quantity = 1;
  let material = raw;

  if (sizeMatch) {
    widthCm = Number(sizeMatch[1] || 0);
    heightCm = Number(sizeMatch[2] || 0);
    material = raw.replace(sizeMatch[0], " ").trim();
  }

  if (qtyMatch) {
    const maybeQty = Number(qtyMatch[1] || 0);
    if (maybeQty > 0) {
      quantity = maybeQty;
      material = material.replace(new RegExp("(?:^|\\s)" + qtyMatch[1] + "\\s*$"), " ").trim();
    }
  }

  material = material.replace(/\s+/g, " ").trim();

  return {
    material,
    widthCm,
    heightCm,
    quantity
  };
}

function normalizeBusabaMaterialKey(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/มิลลิเมตร/g, "มม")
    .replace(/3mm/gi, "3มม")
    .replace(/5mm/gi, "5มม")
    .replace(/10mm/gi, "10มม");
}

function resolveItemCodeFromBusabaMaterial(material) {
  const key = normalizeBusabaMaterialKey(material);

  if (key.indexOf("ไวนิลหลังดำ") !== -1) return "VINYL002";
  if (key.indexOf("ไวนิล") !== -1) return "VINYL001";

  if (key.indexOf("สติกเกอร์พิมพ์ไดคัท") !== -1) return "STKPD001";
  if (key.indexOf("สติกเกอร์ไดคัท") !== -1) return "STKD001";
  if (key.indexOf("สติกเกอร์พิมพ์") !== -1) return "STKP001";

  if (key.indexOf("สติกเกอร์ลงพลาสวูด3") !== -1) return "STKPW003";
  if (key.indexOf("สติกเกอร์ลงพลาสวูด5") !== -1) return "STKPW005";
  if (key.indexOf("สติกเกอร์ลงพลาสวูด10") !== -1) return "STKPW010";

  if (key.indexOf("สติกเกอร์ลงอะคริลิค3") !== -1) return "STKAC003";
  if (key.indexOf("สติกเกอร์ลงอะคริลิค5") !== -1) return "STKAC005";

  if (key.indexOf("พลาสวูด3") !== -1) return "PLAW003";
  if (key.indexOf("พลาสวูด5") !== -1) return "PLAW005";
  if (key.indexOf("พลาสวูด10") !== -1) return "PLAW010";

  if (key.indexOf("อะคริลิค3") !== -1) return "ACRY003";
  if (key.indexOf("อะคริลิค5") !== -1) return "ACRY005";

  if (key.indexOf("นามบัตร") !== -1 || key.indexOf("สิ่งพิมพ์กระดาษ") !== -1) return "CARD001";
  if (key.indexOf("อื่นๆ") !== -1 || key.indexOf("อื่น") !== -1) return "OTHER";

  return "";
}

async function handlerPriceCalc(text) {
  const payload = extractPriceCalcPayload(text);

  if (!payload.material) {
    return [
      "กรุณาระบุวัสดุด้วยค่ะ",
      "",
      "ตัวอย่าง:",
      "#คำนวณราคา ไวนิล 100x50",
      "#คำนวณราคา ไวนิล 100x50 2"
    ].join("\n");
  }

  const itemCode = resolveItemCodeFromBusabaMaterial(payload.material);

  if (!itemCode) {
    return [
      "ไม่พบวัสดุที่คำนวณได้ค่ะ",
      "กรุณาตรวจสอบชื่อวัสดุอีกครั้ง",
      "",
      "หากเป็นงานพิเศษ ให้ใช้คำว่า อื่นๆ"
    ].join("\n");
  }

  if (itemCode === "OTHER") {
    return [
      "💰 ราคาประเมิน",
      "",
      "วัสดุ: " + payload.material,
      "ราคาประเมิน: รอสรุปราคา"
    ].join("\n");
  }

  if (!payload.widthCm || !payload.heightCm) {
    return [
      "กรุณาระบุขนาดให้ครบค่ะ",
      "",
      "ตัวอย่าง:",
      "#คำนวณราคา ไวนิล 100x50",
      "#คำนวณราคา พลาสวูด 3 มิลไดคัท 60x100 2"
    ].join("\n");
  }

  const result = await fetchBusabaPriceCalc({
    material: payload.material,
    width_cm: payload.widthCm,
    height_cm: payload.heightCm,
    quantity: payload.quantity,
    customer_type: "ลูกค้าทั่วไป"
  });

  if (!result.ok) {
    return result.message || "คำนวณราคาไม่สำเร็จค่ะ";
  }

  if (!result.can_auto_price) {
    return [
      "💰 ราคาประเมิน",
      "",
      "วัสดุ: " + payload.material,
      "ขนาด: " + payload.widthCm + "x" + payload.heightCm + " ซม.",
      "จำนวน: " + payload.quantity,
      "ราคาประเมิน: รอสรุปราคา"
    ].join("\n");
  }

  return [
    "💰 ราคาประเมิน",
    "",
    "วัสดุ: " + payload.material,
    "ขนาด: " + payload.widthCm + "x" + payload.heightCm + " ซม.",
    "จำนวน: " + payload.quantity,
    "พื้นที่: " + String(result.area_sq_m || 0) + " ตร.ม.",
    "ราคาประเมิน: " + String(result.price_estimate_text || result.price_estimate || "-") + " บาท"
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("busaba webhook ready");
  }

  try {
    const events = req.body?.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (!event.message) continue;
      if (event.message.type !== "text") continue;

      const text = String(event.message.text || "").trim();
      const replyText = await handleBusabaCommand(text);

      await replyLineMessage(
        event.replyToken,
        replyText,
        String(process.env.LINE_ACCESS_TOKEN_BUSABA || process.env.LINE_ACCESS_TOKEN || "").trim()
      );
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("BUSABA webhook error:", error);
    return res.status(200).send("OK");
  }
}

async function handleBusabaCommand(text) {
  const command = detectBusabaCommand(text);

  if (command === "price_calc") {
    return await handlerPriceCalc(text);
  }

  if (command) {
    return await fetchBusabaReport(command);
  }

  const formUrl = String(
    process.env.BUSABA_FORM_URL ||
    process.env.FORM_URL ||
    "https://docs.google.com/forms/d/e/1FAIpQLScCnZxb5pdwo4VZMjXtZeCBLn8Zl-qAk5df8B1CAZnzYgdQ6A/viewform"
  ).trim();

  return [
    "Busaba พร้อมใช้งานค่ะ",
    "",
    "คำสั่งภายในที่ใช้ได้:",
    "#งานค้าง",
    "#งานวันนี้",
    "#งานด่วน",
    "#สถานะงาน",
    "#สรุปวันนี้",
    "#คำนวณราคา ไวนิล 100x50",
    "#คำนวณราคา ไวนิล 100x50 2",
    "",
    "หากต้องการเปิดงานใหม่",
    "กรอกฟอร์มได้ที่:",
    formUrl
  ].join("\n");
}

async function fetchBusabaReport(reportType) {
  const apiBase = String(
    process.env.BUSABA_REPORT_API_URL ||
    process.env.ISECRETARY_REPORT_API_URL ||
    ""
  ).trim();

  if (!apiBase) {
    return "ยังไม่ได้ตั้งค่า BUSABA_REPORT_API_URL ค่ะ";
  }

  const joinChar = apiBase.includes("?") ? "&" : "?";
  const url = `${apiBase}${joinChar}report=${encodeURIComponent(reportType)}`;

  const response = await fetch(url, { method: "GET", redirect: "follow" });
  const raw = await response.text();

  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return "ไม่สามารถอ่านข้อมูลรายงานได้ค่ะ";
  }

  if (!data.ok) {
    return data.message || "ไม่พบข้อมูลรายงานค่ะ";
  }

  return data.text || "ไม่พบข้อความรายงานค่ะ";
}

async function fetchBusabaPriceCalc(payload) {
  const apiBase = String(
    process.env.BUSABA_REPORT_API_URL ||
    process.env.ISECRETARY_REPORT_API_URL ||
    ""
  ).trim();

  if (!apiBase) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า BUSABA_REPORT_API_URL" };
  }

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "price-calc",
      payload
    })
  });

  try {
    return await response.json();
  } catch (err) {
    return { ok: false, message: "ไม่สามารถอ่านผลคำนวณราคาได้" };
  }
}

async function replyLineMessage(replyToken, text, accessToken) {
  if (!accessToken) {
    console.error("Missing LINE access token for Busaba");
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
  console.log("BUSABA LINE REPLY STATUS:", response.status);
  console.log("BUSABA LINE REPLY BODY:", body);
}
