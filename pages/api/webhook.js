import { supabaseServer } from '../../lib/supabaseServer';
import { sendMessage } from '../../lib/telegram';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const body = req.body || {};
  const msg = body.message || body.my_chat_member || body.edited_message;
  if (!msg || !msg.from) return res.status(200).json({ ok: true });

  const chatId = msg.from.id;
  const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

  // Upsert user with default role pilot
  await supabaseServer.from('users').upsert({ tg_id: chatId, full_name: fullName, role: 'pilot' }, { onConflict: ['tg_id'] });

  // Send message with WebApp button
  try {
    await sendMessage(chatId, 'Откройте мини-приложение:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть MiniApp', web_app: { url: (process.env.TELEGRAM_WEBAPP_ORIGIN || '') + '/webapp' } }],
        ],
      },
    });
  } catch (e) {
    console.error('sendMessage failed', e);
  }

  return res.status(200).json({ ok: true });
}