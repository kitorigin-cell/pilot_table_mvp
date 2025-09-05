import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { apiFetch } from '../lib/apiClient';

export default function FlightsStats() {
  const [data, setData] = useState([]);

  useEffect(()=> {
    async function load() {
      try {
        const res = await apiFetch('/api/flights');
        // res may hide costs for some roles; aggregate what's available
        const agg = {};
        (res || []).forEach(f => {
          const month = f.flight_date ? dayjs(f.flight_date).format('YYYY-MM') : 'unknown';
          if (!agg[month]) agg[month] = { month, costs:0, revenue:0 };
          agg[month].costs += Number(f.costs || 0);
          agg[month].revenue += Number(f.revenue || 0);
        });
        setData(Object.values(agg));
      } catch (e) {
        console.error('load stats', e);
      }
    }
    load();
  }, []);

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-2">Статистика прибыли и затрат (по месяцам)</h2>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="revenue" name="Прибыль" fill="#16a34a" />
            <Bar dataKey="costs" name="Затраты" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: '100%', height: 260, marginTop: 16 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#16a34a" name="Прибыль" />
            <Line type="monotone" dataKey="costs" stroke="#dc2626" name="Затраты" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}