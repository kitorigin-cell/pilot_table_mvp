// pages/api/flights.js
import { supabaseServer } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  switch (req.method) {
    case 'GET':
      const { data, error } = await supabaseServer.from('flights').select('*');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);

    case 'POST':
      const flightData = req.body;
      const { data: insertData, error: insertError } = await supabaseServer
        .from('flights')
        .insert([flightData])
        .select();
      if (insertError) return res.status(500).json({ error: insertError.message });
      return res.status(201).json(insertData);

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}