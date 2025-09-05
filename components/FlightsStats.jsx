import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
export default function FlightsStats({ supabaseClient }) {
  const [data, setData] = useState([]);
  useEffect(()=>{ async function load(){ const res = await fetch('/api/flights'); const flights = await res.json(); const agg=flights.reduce((acc,f)=>{const m=dayjs(f.flight_date).format('YYYY-MM'); if(!acc[m]) acc[m]={month:m,costs:0,revenue:0}; acc[m].costs+=Number(f.costs||0); acc[m].revenue+=Number(f.revenue||0); return acc;},{}); setData(Object.values(agg)); } load(); },[]);
  return (<div className="mt-6"><h2 className="text-lg font-semibold mb-2">Статистика</h2><ResponsiveContainer width="100%" height={300}><BarChart data={data}><XAxis dataKey="month"/><YAxis/><Tooltip/><Legend/><Bar dataKey="revenue" fill="#4ade80" name="Прибыль"/><Bar dataKey="costs" fill="#f87171" name="Затраты"/></BarChart></ResponsiveContainer></div>);
}