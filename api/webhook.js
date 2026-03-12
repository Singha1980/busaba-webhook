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
  if (text === "เมนู" || text.toLowerCase() === "menu") {
    return [
      "BUSABA SIGN SYSTEM",
      "",
      "คำสั่งที่ใช้ได้",
      "- เมนู",
      "- เปิดงาน",
      "- dashboard"
    ].join("\n");
  }

  if (text === "เปิดงาน") {
    return `กรอกข้อมูลเปิดงานใหม่ได้ที่นี่ครับ\n${process.env.BUSABA_FORM_URL || "ยังไม่ได้ตั้งค่า BUSABA_FORM_URL"}`;
  }

  if (text.toLowerCase() === "dashboard") {
    return `ดู Dashboard ได้ที่\n${process.env.BUSABA_DASHBOARD_URL || "ยังไม่ได้ตั้งค่า BUSABA_DASHBOARD_URL"}`;
  }

  return [
    "BUSABA SIGN SYSTEM",
    "",
    "พิมพ์คำสั่งได้ เช่น",
    "- เมนู",
    "- เปิดงาน",
    "- dashboard"
  ].join("\n");
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
