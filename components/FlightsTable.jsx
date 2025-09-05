import { useEffect, useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import dayjs from 'dayjs';
import Papa from 'papaparse';
import { apiFetch } from '../lib/apiClient';

/**
 * Props:
 *  - user: telegram user object (from WebApp)
 *  - role: 'pilot'|'manager'|'accountant'|'admin'
 */
export default function FlightsTable({ user, role }) {
  const [flights, setFlights] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [editing, setEditing] = useState(null); // flight id being edited
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(()=> { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/flights');
      setFlights(data || []);
    } catch (e) {
      console.error('load flights', e);
    } finally { setLoading(false); }
  }

  const [startDate, endDate] = dateRange;

  const filtered = useMemo(()=> flights.filter(f => {
    if (statusFilter && f.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!( (f.route||'').toLowerCase().includes(q) || (f.manager_comment||'').toLowerCase().includes(q) )) return false;
    }
    if (startDate && new Date(f.flight_date) < startDate) return false;
    if (endDate && new Date(f.flight_date) > endDate) return false;
    return true;
  }), [flights, search, statusFilter, startDate, endDate]);

  function exportCSV() {
    const csv = Papa.unparse(filtered.map(r => ({
      id: r.id, flight_date: r.flight_date, route: r.route, costs: r.costs, revenue: r.revenue, status: r.status, manager_comment: r.manager_comment, pilot_comment: r.pilot_comment
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `flights_${dayjs().format('YYYYMMDD_HHmm')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function startEdit(f) {
    setEditing(f.id);
    setForm({
      route: f.route,
      flight_date: f.flight_date,
      costs: f.costs ?? '',
      revenue: f.revenue ?? '',
      manager_comment: f.manager_comment ?? '',
      pilot_comment: f.pilot_comment ?? '',
      status: f.status
    });
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await apiFetch('/api/flights', {
        method: 'PUT',
        body: JSON.stringify({ id: editing, ...form })
      });
      setEditing(null);
      await load();
    } catch (e) {
      alert('Ошибка при сохранении: ' + e.message);
    }
  }

  async function createFlight() {
    // manager/admin create flow: minimal example prompt
    const route = prompt('Введите маршрут (например: SVO-MOW):');
    const date = prompt('Дата YYYY-MM-DD:');
    if (!route || !date) return;
    try {
      await apiFetch('/api/flights', { method: 'POST', body: JSON.stringify({ route, flight_date: date, status: 'planned' }) });
      await load();
    } catch (e) {
      alert('Ошибка создания: ' + e.message);
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-2 items-center mb-4">
        <input className="border p-2 rounded w-full md:w-56" placeholder="Поиск по маршруту или комментарию" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="border p-2 rounded" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="planned">Запланирован</option>
          <option value="in_progress">Выполняется</option>
          <option value="done">Выполнен</option>
          <option value="cancelled">Отменен</option>
        </select>
        <DatePicker selectsRange startDate={startDate} endDate={endDate} onChange={setDateRange} isClearable className="border p-2 rounded" />
        <div className="ml-auto flex gap-2">
          {(role === 'admin' || role === 'manager') && <button className="px-3 py-2 bg-sky-600 text-white rounded" onClick={createFlight}>Создать рейс</button>}
          <button className="px-3 py-2 bg-gray-600 text-white rounded" onClick={exportCSV}>Экспорт CSV</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="p-2 border">Дата</th>
              <th className="p-2 border">Маршрут</th>
              <th className="p-2 border">Затраты</th>
              <th className="p-2 border">Прибыль</th>
              <th className="p-2 border">Статус</th>
              <th className="p-2 border">Комментарии</th>
              <th className="p-2 border">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} className="border-t">
                <td className="p-2">{dayjs(f.flight_date).format('YYYY-MM-DD')}</td>
                <td className="p-2">{f.route}</td>
                <td className="p-2">{(role === 'admin' || role === 'accountant') ? (f.costs ?? '-') : '—'}</td>
                <td className="p-2">{(role === 'admin' || role === 'accountant') ? (f.revenue ?? '-') : '—'}</td>
                <td className="p-2">{f.status}</td>
                <td className="p-2">
                  <div className="text-sm">Менеджер: {f.manager_comment || '-'}</div>
                  <div className="text-sm">Пилот: {f.pilot_comment || '-'}</div>
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    {/* Edit button visible if role can edit any field or pilot can edit pilot_comment/status */}
                    {((role === 'admin') || (role === 'manager') || (role === 'accountant') || (role === 'pilot')) &&
                      <button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={()=>startEdit(f)}>Edit</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-4 p-3 border rounded bg-white">
          <h3 className="font-semibold mb-2">Редактировать рейс</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="block">
              Дата
              <input className="border p-1 w-full" value={form.flight_date} onChange={e=>setForm({...form,flight_date:e.target.value})} />
            </label>
            <label className="block">
              Маршрут
              <input className="border p-1 w-full" value={form.route} onChange={e=>setForm({...form,route:e.target.value})} />
            </label>
            {(role === 'admin' || role === 'accountant') && (
              <>
                <label>Затраты<input className="border p-1 w-full" value={form.costs} onChange={e=>setForm({...form,costs:e.target.value})} /></label>
                <label>Прибыль<input className="border p-1 w-full" value={form.revenue} onChange={e=>setForm({...form,revenue:e.target.value})} /></label>
              </>
            )}
            <label>Комментарий менеджера<textarea className="border p-1 w-full" value={form.manager_comment} onChange={e=>setForm({...form,manager_comment:e.target.value})} /></label>
            <label>Комментарий пилота<textarea className="border p-1 w-full" value={form.pilot_comment} onChange={e=>setForm({...form,pilot_comment:e.target.value})} /></label>
            <label>Статус
              <select className="border p-1 w-full" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option value="planned">Запланирован</option>
                <option value="in_progress">Выполняется</option>
                <option value="done">Выполнен</option>
                <option value="cancelled">Отменен</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={saveEdit}>Сохранить</button>
            <button className="px-3 py-2 bg-gray-300 rounded" onClick={()=>setEditing(null)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}