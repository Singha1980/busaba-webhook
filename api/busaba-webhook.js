/*************************************************
 * BUSABA WEBHOOK
 * ใช้เฉพาะ LINE OA Busaba
 *************************************************/

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
      const userId = event.source?.userId || "";

      console.log("BUSABA TEXT:", text);
      console.log("BUSABA USER:", userId);

      const replyText = await handleBusabaCommand(text, userId);

      console.log("BUSABA REPLY:", replyText);

      await replyLineMessage(
        event.replyToken,
        replyText,
        String(process.env.LINE_ACCESS_TOKEN || "").trim()
      );
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("BUSABA webhook error:", error);
    return res.status(200).send("OK");
  }
}

/* =========================================================
 * BUSABA COMMANDS
 * ========================================================= */

async function handleBusabaCommand(text, userId) {
  const lower = String(text || "").trim().toLowerCase();

  if (text === "เมนู" || lower === "menu") {
    return buildBusabaMenuText();
  }

  if (text === "เปิดงาน") {
    return [
      "กรอกข้อมูลเปิดงานใหม่ได้ที่นี่ครับ",
      String(process.env.BUSABA_FORM_URL || "ยังไม่ได้ตั้งค่า BUSABA_FORM_URL").trim()
    ].join("\n");
  }

  if (lower === "dashboard") {
    return [
      "ดู Dashboard ได้ที่",
      String(process.env.BUSABA_DASHBOARD_URL || "ยังไม่ได้ตั้งค่า BUSABA_DASHBOARD_URL").trim()
    ].join("\n");
  }

  const priceReply = await buildPriceReplyFromApi(text, userId);
  if (priceReply) return priceReply;

  return buildBusabaMenuText();
}

function buildBusabaMenuText() {
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

/* =========================================================
 * PRICE FLOW
 * ========================================================= */

async function buildPriceReplyFromApi(text, userId) {
  const apiBase = String(process.env.BUSABA_PRICE_API_URL || "").trim();
  if (!apiBase) {
    return "ยังไม่ได้ตั้งค่า BUSABA_PRICE_API_URL";
  }

  const size = extractSize(text);
  if (!size) return "";

  const joinChar = apiBase.includes("?") ? "&" : "?";
  const apiUrl = `${apiBase}${joinChar}line_id=${encodeURIComponent(userId)}`;

  const data = await fetchPriceData(apiUrl);
  if (!data || !data.ok) {
    return "ไม่สามารถอ่านข้อมูลราคาจากระบบได้";
  }

  const matchedRule = (data.rules || []).find(rule => {
    return (
      String(rule.active || "").toUpperCase() === "TRUE" &&
      text.includes(String(rule.keyword || "").trim())
    );
  });

  if (!matchedRule) return "";

  const item = (data.catalog || []).find(c => {
    return String(c.item_code || "").trim() === String(matchedRule.item_code || "").trim();
  });

  if (!item) {
    return "พบประเภทงาน แต่ไม่พบข้อมูลราคาใน PRICE_CATALOG";
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

  return [
    "ประเมินราคางานเบื้องต้น",
    "",
    "ประเภทลูกค้า: " + customerType,
    "ประเภทงาน: " + String(item.item_name || "-").trim(),
    "ขนาด: " + size.widthCm + "x" + size.heightCm + " ซม.",
    "พื้นที่: " + areaSqM.toFixed(2) + " ตร.ม.",
    "ราคา: " + Math.round(price).toLocaleString("en-US") + " บาท"
  ].join("\n");
}

function extractSize(text) {
  const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
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

    console.log("BUSABA PRICE STATUS:", response.status);
    console.log("BUSABA PRICE RAW:", rawText);

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

async function replyLineMessage(replyToken, text, accessToken) {
  if (!accessToken) {
    console.error("Missing LINE_ACCESS_TOKEN");
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
