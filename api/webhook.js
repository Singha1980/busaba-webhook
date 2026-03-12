export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Busaba webhook ready");
  }

  try {
    const events = req.body?.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (!event.message) continue;
      if (event.message.type !== "text") continue;

      const text = String(event.message.text || "").trim();
      const userId = event.source?.userId || "";

      console.log("LINE SOURCE:", JSON.stringify(event.source));
      console.log("TEXT:", text);

      const replyText = await handleCommand(text, userId);
      await reply(event.replyToken, replyText);
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).send("OK");
  }
}

async function handleCommand(text, userId) {
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

  const apiUrl = `${apiBase}&line_id=${encodeURIComponent(userId)}`;
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

async function reply(replyToken, text) {
  const url = "https://api.line.me/v2/bot/message/reply";

  const payload = {
    replyToken,
    messages: [
      {
        type: "text",
        text
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LINE_ACCESS_TOKEN}`
    },
    body: JSON.stringify(payload)
  });

  const body = await response.text();
  console.log("LINE reply:", response.status, body);
}
