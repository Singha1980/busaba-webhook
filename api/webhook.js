async function parseWithGPT(text) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "คุณคือเลขาส่วนตัวชื่อ iSecretary",
              "ให้ตอบเป็น JSON เท่านั้น ห้ามมี markdown ห้ามมี code fence ห้ามมีคำอธิบาย",
              "intent ต้องเป็นหนึ่งใน: task, appointment, search_web, chat",
              "domain ต้องเป็นหนึ่งใน: สมาคมนักธุรกิจ, เทศบาลเขาชีจรรย์, ร้านป้าย หรือ \"\"",
              "ต้องส่ง keys นี้กลับมาเสมอ:",
              "intent, domain, date, time, detail, location, note, missing_fields, reply_text",
              "missing_fields ต้องเป็น array",
              "ถ้าเป็น chat ให้ใส่ reply_text",
              "ถ้าไม่แน่ใจให้ใส่ค่าว่าง \"\"",
              "ตัวอย่างรูปแบบที่ถูก:",
              "{\"intent\":\"task\",\"domain\":\"ร้านป้าย\",\"date\":\"2026-03-13\",\"time\":\"10:00\",\"detail\":\"โทรตามลูกค้า\",\"location\":\"\",\"note\":\"\",\"missing_fields\":[],\"reply_text\":\"\"}"
            ].join("\n")
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";

    console.log("GPT RAW CONTENT:", content);

    let parsed = {};
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      const cleaned = String(content)
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      parsed = JSON.parse(cleaned);
    }

    return {
      intent: String(parsed.intent || "").trim(),
      domain: String(parsed.domain || "").trim(),
      date: String(parsed.date || "").trim(),
      time: String(parsed.time || "").trim(),
      detail: String(parsed.detail || "").trim(),
      location: String(parsed.location || "").trim(),
      note: String(parsed.note || "").trim(),
      missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
      reply_text: String(parsed.reply_text || "").trim()
    };

  } catch (err) {
    console.error("parseWithGPT error:", err);
    return {
      intent: "chat",
      domain: "",
      date: "",
      time: "",
      detail: "",
      location: "",
      note: "",
      missing_fields: [],
      reply_text: "ไอซ์ยังตีความไม่สำเร็จค่ะ ลองพิมพ์ใหม่อีกนิดนะคะ"
    };
  }
}
