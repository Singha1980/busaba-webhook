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

      console.log("LINE DESTINATION:", destination);
      console.log("LINE SOURCE:", JSON.stringify(event.source));
      console.log("TEXT:", text);

      const botType = detectBotType(text, destination);

      let replyText = "";
      if (botType === "ISECRETARY") {
        replyText = await handleISecretaryCommand(text, userId);
      } else {
        replyText = await handleBusabaCommand(text, userId);
      }

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
 * BOT ROUTER
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

  // ภายหลังถ้าคุณรู้ destination ของ OA แต่ละตัว ค่อยมาใส่ตรงนี้
  // if (destination === "Uxxxxxxxxxxxxxxxxxx") return "BUSABA";
  // if (destination === "Uyyyyyyyyyyyyyyyyyy") return "ISECRETARY";

  return "";
}

function isISecretaryCommandText(text) {
  const cmd = normalizeText(text);

  if (cmd.includes("งานวันนี้")) return true;
  if (cmd.includes("งานค้าง")) return true;
  if (cmd.includes("สรุปวันนี้")) return true;
  if (cmd.includes("พรุ่งนี้มีนัดไหม")) return true;
  if (cmd.includes("พรุ่งนี้มีนัดมั้ย")) return true;

  return false;
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
 * BUSABA COMMANDS
 * ========================================================= */

async function handleBusabaCommand(text, userId) {
  const lower = text.toLowerCase();

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
 * ISECRETARY COMMANDS
 * ========================================================= */

async function handleISecretaryCommand(text, userId) {
  const cmd = normalizeText(text);

  if (cmd.includes("งานวันนี้")) {
    return await fetchISecretaryReport("today_tasks");
  }

  if (cmd.includes("งานค้าง")) {
    return await fetchISecretaryReport("overdue_tasks");
  }

  if (cmd.includes("สรุปวันนี้")) {
    return await fetchISecretaryReport("today_summary");
  }

  if (cmd.includes("พรุ่งนี้มีนัดไหม") || cmd.includes("พรุ่งนี้มีนัดมั้ย")) {
    return await fetchISecretaryReport("tomorrow_appointments");
  }

  return [
    "iSecretary",
    "",
    "คำสั่งที่ใช้ได้:",
    "- งานวันนี้",
    "- งานค้าง",
    "- สรุปวันนี้",
    "- พรุ่งนี้มีนัดไหม"
  ].join("\n");
}

async function fetchISecretaryReport(reportType) {
  const apiBase = String(process.env.ISECRETARY_REPORT_API_URL || "").trim();

  if (!apiBase) {
    return "ยังไม่ได้ตั้งค่า ISECRETARY_REPORT_API_URL";
  }

  try {
    const joinChar = apiBase.includes("?") ? "&" : "?";
    const url = `${apiBase}${joinChar}report=${encodeURIComponent(reportType)}`;

    console.log("ISECRETARY REPORT URL:", url);

    const response = await fetch(url, { method: "GET", redirect: "follow" });
    const rawText = await response.text();

    console.log("ISECRETARY REPORT STATUS:", response.status);
    console.log("ISECRETARY REPORT BODY:", rawText);

    if (!response.ok) {
      return "ไม่สามารถดึงรายงาน iSecretary ได้";
    }

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      return rawText || "ไม่พบข้อมูลรายงาน";
    }

    if (!data) return "ไม่พบข้อมูลรายงาน";
    if (data.ok === false) return data.message || "เกิดข้อผิดพลาดในการอ่านรายงาน";

    return data.text || "ไม่พบข้อความรายงาน";
  } catch (error) {
    console.error("fetchISecretaryReport error:", error);
    return "ไม่สามารถเชื่อมต่อระบบรายงาน iSecretary ได้";
  }
}

/* =========================================================
 * PRICE CALC
 * ========================================================= */

async function calculatePriceFromSheet(text, userId) {
  const apiBase = process.env.BUSABA_PRICE_API_URL;
  if (!apiBase) {
    console.error("BUSABA_PRICE_API_URL is missing");
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
    console.log("PRICE API URL:", apiUrl);

    const response = await fetch(apiUrl, { method: "GET" });
    const rawText = await response.text();

    console.log("PRICE API STATUS:", response.status);
    console.log("PRICE API BODY:", rawText);

    if (!response.ok) return null;

    return JSON.parse(rawText);
  } catch (error) {
    console.error("fetchPriceData error:", error);
    return null;
  }
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

  const url = "https://api.line.me/v2/bot/message/reply";

  const payload = {
    replyToken,
    messages: [
      {
        type: "text",
        text: String(text || "").slice(0, 5000)
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${finalToken}`
    },
    body: JSON.stringify(payload)
  });

  const body = await response.text();
  console.log("LINE reply:", response.status, body);
}
