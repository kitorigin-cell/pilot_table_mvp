// pages/api/users.js
import { supabaseServer } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  const { tg_id } = req.query;

  switch (req.method) {
    case 'GET':
      if (!tg_id) return res.status(400).json({ error: 'tg_id is required' });
      const { data, error } = await supabaseServer
        .from('users')
        .select('*')
        .eq('tg_id', tg_id)
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ user: data });

    case 'PUT':
      const { role } = req.body;
      if (!tg_id || !role) return res.status(400).json({ error: 'tg_id and role required' });
      const { data: updated, error: updateError } = await supabaseServer
        .from('users')
        .update({ role })
        .eq('tg_id', tg_id)
        .select()
        .single();
      if (updateError) return res.status(500).json({ error: updateError.message });
      return res.status(200).json(updated);

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}