// server-side Telegram helper (uses global fetch available in Node 18+ on Vercel)
const TELEGRAM_API = (token => token ? `https://api.telegram.org/bot${token}` : null)(process.env.TELEGRAM_BOT_TOKEN);

export async function sendMessage(chat_id, text, extra = {}) {
  if (!TELEGRAM_API) {
    console.warn('TELEGRAM_BOT_TOKEN not set');
    return null;
  }
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, ...extra }),
  });
  return res.json();
}