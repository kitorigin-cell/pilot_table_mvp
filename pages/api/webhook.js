import { supabaseServer } from '../../lib/supabaseServer';
import { sendMessage } from '../../lib/telegram';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const body = req.body;
  const msg = body.message;
  if (!msg) return res.status(200).json({ok:true});
  const chatId = msg.from.id;
  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
  await supabaseServer.from('users').upsert({ tg_id: chatId, full_name: fullName }, { onConflict: ['tg_id'] });
  await sendMessage(chatId, 'Открой мини-приложение:', {
    reply_markup: { inline_keyboard: [[{text:'Открыть MiniApp', web_app: {url: process.env.TELEGRAM_WEBAPP_ORIGIN + '/webapp'}}]] }
  });
  res.status(200).json({ ok: true });
}