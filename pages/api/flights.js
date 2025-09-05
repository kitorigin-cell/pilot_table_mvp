import { supabaseServer } from '../../lib/supabaseServer';
import { sendMessage } from '../../lib/telegram';

async function getUser(tg_id) {
  const { data, error } = await supabaseServer.from('users').select('*').eq('tg_id', Number(tg_id)).single();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data || null;
}

async function logAction(user_id, action, details) {
  try {
    await supabaseServer.from('audit_log').insert({ user_id: Number(user_id), action, details });
  } catch (e) {
    console.error('audit insert error', e);
  }
}

export default async function handler(req, res) {
  const { method, body } = req;
  // accept tg_id from header or query (apiFetch provides header)
  const tg_id = req.headers['x-telegram-id'] || req.query.tg_id;
  if (!tg_id) return res.status(401).json({ error: 'Missing x-telegram-id header' });

  let user;
  try {
    user = await getUser(Number(tg_id));
    if (!user) return res.status(403).json({ error: 'User not found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }

  try {
    if (method === 'GET') {
      const { data, error } = await supabaseServer.from('flights').select('*').order('flight_date', { ascending: true });
      if (error) throw error;
      // Filter fields based on role before returning to client
      const out = data.map((f) => {
        if (user.role === 'pilot' || user.role === 'manager') {
          // hide costs/revenue for pilot and manager
          const { costs, revenue, ...rest } = f;
          return rest;
        }
        return f;
      });
      return res.status(200).json(out);
    }

    if (method === 'POST') {
      // Create flight. Allowed: admin, manager
      if (!['admin', 'manager'].includes(user.role)) return res.status(403).json({ error: 'not allowed to create flight' });
      const insert = { ...body, created_by: Number(tg_id) };
      const { data, error } = await supabaseServer.from('flights').insert([insert]).select().single();
      if (error) throw error;
      await logAction(Number(tg_id), 'create_flight', { flight_id: data.id });
      return res.status(201).json(data);
    }

    if (method === 'PUT') {
      // body must include id and fields to update
      const { id, ...rest } = body;
      if (!id) return res.status(400).json({ error: 'id required' });

      const { data: existing, error: e1 } = await supabaseServer.from('flights').select('*').eq('id', id).single();
      if (e1) throw e1;
      if (!existing) return res.status(404).json({ error: 'flight not found' });

      // Build allowed updates by role
      let updates = { ...rest };

      if (user.role === 'pilot') {
        // pilot can only change pilot_comment and status (to in_progress or done)
        updates = {
          pilot_comment: rest.pilot_comment ?? existing.pilot_comment,
          status: rest.status ?? existing.status,
        };
        if (updates.status && !['in_progress', 'done'].includes(updates.status)) {
          delete updates.status;
        }
      } else if (user.role === 'manager') {
        // manager cannot change costs/revenue
        delete updates.costs;
        delete updates.revenue;
      } else if (user.role === 'accountant') {
        // accountant can only change costs and revenue
        updates = {
          costs: rest.costs ?? existing.costs,
          revenue: rest.revenue ?? existing.revenue,
        };
      } // admin allowed everything

      const { data, error } = await supabaseServer.from('flights').update(updates).eq('id', id).select().single();
      if (error) throw error;

      await logAction(Number(tg_id), 'update_flight', { flight_id: id, updates });

      // notify on status change
      if (updates.status && updates.status !== existing.status) {
        // collect recipients: creator + all admins + manager(s)
        const recQ = await supabaseServer.from('users').select('tg_id,role').or(`role.eq.admin,role.eq.manager`);
        const recs = (recQ.data || []).map(r => r.tg_id).filter(Boolean);
        // include created_by
        if (existing.created_by) recs.push(existing.created_by);
        const uniqueRecs = Array.from(new Set(recs));
        const text = `✈️ Статус полёта ${existing.route} (${existing.flight_date}) изменён на *${updates.status}*.\nИзменил: ${user.full_name} (${user.role})`;
        await Promise.all(uniqueRecs.map(id => sendMessage(id, text, { parse_mode: 'Markdown' })));
      }

      return res.status(200).json(data);
    }

    if (method === 'DELETE') {
      // delete only admin
      if (user.role !== 'admin') return res.status(403).json({ error: 'not allowed' });
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const { data: before, error } = await supabaseServer.from('flights').select('*').eq('id', id).single();
      if (error) throw error;
      await supabaseServer.from('flights').delete().eq('id', id);
      await logAction(Number(tg_id), 'delete_flight', { before });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}