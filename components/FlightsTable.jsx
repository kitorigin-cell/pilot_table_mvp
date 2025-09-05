import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
export default function FlightTable({ user, supabaseClient }) {
  const [flights, setFlights] = useState([]);
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(()=>{ if(!user) return; fetch('/api/users?tg_id='+user.tg_id).then(r=>r.json()).then(d=>{ setMe(d.user); loadFlights(); }); },[user]);
  async function loadFlights(){ const res = await fetch('/api/flights'); setFlights(await res.json()); }
  const filtered = flights.filter(f => (!search || f.route.toLowerCase().includes(search.toLowerCase())) && (!statusFilter || f.status===statusFilter));
  return (<div>
    <div className="flex gap-2 mb-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск" className="border p-1"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border p-1"><option value="">Все</option><option value="planned">Запланирован</option><option value="in_progress">Выполняется</option><option value="done">Выполнен</option><option value="cancelled">Отменен</option></select></div>
    <table className="w-full table-auto"><thead><tr><th>Дата</th><th>Маршрут</th><th>Затраты</th><th>Прибыль</th><th>Статус</th><th>Комментарии</th></tr></thead><tbody>
      {filtered.map(f=>(<tr key={f.id}><td>{dayjs(f.flight_date).format('YYYY-MM-DD')}</td><td>{f.route}</td><td>{me?.role==='pilot'?'—':f.costs}</td><td>{me?.role==='pilot'?'—':f.revenue}</td><td>{f.status}</td><td><div>Менеджер: {f.manager_comment}</div><div>Пилот: {f.pilot_comment}</div></td></tr>))}
    </tbody></table></div>);
}