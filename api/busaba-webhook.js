/*************************************************
 * BUSABA WEBHOOK
 * ใช้สำหรับ LINE OA Busaba
 * - คำสั่งภายในออฟฟิศ
 * - ตอบลิงก์ฟอร์มสำหรับเปิดงาน
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

  return "";
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

      console.log("BUSABA TEXT:", text);

      const replyText = await handleBusabaCommand(text);

      console.log("BUSABA REPLY:", replyText);

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
  const reportType = detectBusabaCommand(text);

  if (reportType) {
    return await fetchBusabaReport(reportType);
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
