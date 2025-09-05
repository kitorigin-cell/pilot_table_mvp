import { supabaseServer } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  const { method } = req;
  if (method === 'GET') {
    const tg_id = req.query.tg_id || req.headers['x-telegram-id'];
    if (!tg_id) return res.status(400).json({ error: 'tg_id required' });

    const { data, error } = await supabaseServer.from('users').select('*').eq('tg_id', Number(tg_id)).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.status(200).json({ user: data || null });
  }

  if (method === 'PUT') {
    // Change role (admin only). Expects body: { target_tg_id, role, actor_tg_id }
    const { target_tg_id, role, actor_tg_id } = req.body || {};
    if (!target_tg_id || !role || !actor_tg_id) return res.status(400).json({ error: 'target_tg_id, role and actor_tg_id required' });

    // Check actor role
    const actorQ = await supabaseServer.from('users').select('role').eq('tg_id', Number(actor_tg_id)).single();
    const actor = actorQ.data;
    if (!actor || actor.role !== 'admin') return res.status(403).json({ error: 'not allowed' });

    const { data, error } = await supabaseServer.from('users').update({ role }).eq('tg_id', Number(target_tg_id)).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await supabaseServer.from('audit_log').insert({ user_id: Number(actor_tg_id), action: 'change_role', details: { target: Number(target_tg_id), role } });

    return res.status(200).json({ ok: true, user: data });
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  res.status(405).end(`Method ${method} Not Allowed`);
}