const TELEGRAM_API = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
export async function sendMessage(chat_id, text, extra = {}){
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id, text, ...extra })
  }); return res.json();
}