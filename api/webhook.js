export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(200).send("Busaba webhook ready");
  }

  const events = req.body.events || [];

  for (const event of events) {

    if (event.type !== "message") continue;
    if (event.message.type !== "text") continue;

    const text = event.message.text;

    await reply(event.replyToken, "BUSABA: " + text);

  }

  return res.status(200).send("OK");
}

async function reply(replyToken, text) {

  const url = "https://api.line.me/v2/bot/message/reply";

  await fetch(url,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${process.env.LINE_ACCESS_TOKEN}`
    },
    body:JSON.stringify({
      replyToken:replyToken,
      messages:[{type:"text",text:text}]
    })
  });

}
