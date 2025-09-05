// components/FlightsTable.jsx
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

export default function FlightTable({ user, supabaseClient }){
  const [flights, setFlights] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(()=>{
    if(!user) return;
    // fetch role from server
    fetch('/api/users?tg_id=' + user.tg_id).then(r=>r.json()).then(d=>{ setMe(d.user); loadFlights(d.user.role); });
  },[user]);

  async function loadFlights(role){
    const res = await fetch('/api/flights');
    const data = await res.json();
    setFlights(data);
  }

  function canEditFlightField(role, field){
    if(role === 'admin') return true;
    if(role === 'manager') return field !== 'costs' && field !== 'revenue';
    if(role === 'accountant') return field === 'costs' || field === 'revenue';
    if(role === 'pilot') return false;
    return false;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left">
              <th>Дата</th>
              <th>Маршрут</th>
              <th>Затраты</th>
              <th>Прибыль</th>
              <th>Статус</th>
              <th>Комментарии</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {flights.map(f => (
              <tr key={f.id} className="border-t">
                <td>{dayjs(f.flight_date).format('YYYY-MM-DD')}</td>
                <td>{f.route}</td>
                <td>{me?.role === 'pilot' ? '—' : f.costs}</td>
                <td>{me?.role === 'pilot' ? '—' : f.revenue}</td>
                <td>{f.status}</td>
                <td>
                  <div>Менеджер: {f.manager_comment}</div>
                  <div>Пилот: {f.pilot_comment}</div>
                </td>
                <td>
                  {/* Actions based on role: edit, change status, edit pilot comment */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}