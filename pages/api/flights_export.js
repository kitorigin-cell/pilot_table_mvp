import { supabaseServer } from '../../lib/supabaseServer';
export default async function handler(req, res){
// optional: check actor role
const { data } = await
supabaseServer.from('flights').select('*').order('flight_date', { ascending:
true });
const header =
['id','flight_date','route','costs','revenue','status','manager_comment','pilot_comment'];
const lines = [header.join(',')];
data.forEach(r => lines.push(header.map(h=>'"'+((r[h]||'')+'').replace(/"/
g,'""')+'"').join(',')));
res.setHeader('Content-Type','text/csv');
res.setHeader('Content-Disposition', `attachment;
filename="flights_export.csv"`);
res.send(lines.join('
'));
}
