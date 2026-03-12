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

      console.log("LINE SOURCE:", JSON.stringify(event.source));

      const text = String(event.message.text || "").trim();
      const replyText = handleCommand(text);

      await reply(event.replyToken, replyText);
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).send("OK");
  }
}

function handleCommand(text) {
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

  // ===== Auto Price Calculator =====
  const priceResult = calculatePriceFromText(text);
  if (priceResult) {
    if (!priceResult.ok) return priceResult.message;

    return [
      "ประเมินราคางานเบื้องต้น",
      "",
      "ประเภท: " + priceResult.itemName,
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

function calculatePriceFromText(text) {
  const size = extractSize(text);
  if (!size) return null;

  let item = null;

  if (text.includes("ไวนิล")) {
    item = { itemName: "ไวนิล", pricePerSqM: 200, minPrice: 1200 };
  } else if (text.includes("คอมโพสิต")) {
    item = { itemName: "คอมโพสิต", pricePerSqM: 2500, minPrice: 3000 };
  } else if (text.includes("อะคริลิค")) {
    item = { itemName: "อะคริลิค", pricePerSqM: 3500, minPrice: 2500 };
  } else {
    return null;
  }

  const areaSqM = (size.widthCm * size.heightCm) / 10000;
  let price = areaSqM * item.pricePerSqM;
  if (price < item.minPrice) price = item.minPrice;

  return {
    ok: true,
    itemName: item.itemName,
    widthCm: size.widthCm,
    heightCm: size.heightCm,
    areaSqM,
    price: Math.round(price)
  };
}

function extractSize(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
  if (!m) {
    return {
      ok: false,
      message: "พบประเภทงานแล้ว แต่ยังไม่พบขนาด เช่น 100x200"
    };
  }

  return {
    widthCm: Number(m[1]),
    heightCm: Number(m[2])
  };
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
