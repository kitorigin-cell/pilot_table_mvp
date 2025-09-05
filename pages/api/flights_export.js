import { supabaseServer } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');
  try {
    const { data, error } = await supabaseServer.from('flights').select('*').order('flight_date', { ascending: true });
    if (error) throw error;
    const header = ['id','flight_date','route','costs','revenue','status','manager_comment','pilot_comment'];
    const lines = [header.join(',')];
    data.forEach(r =>
      lines.push(
        header.map(h => '"' + ((r[h] || '') + '').replace(/"/g, '""') + '"').join(',')
      )
    );
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="flights_export.csv"');
    res.status(200).send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}