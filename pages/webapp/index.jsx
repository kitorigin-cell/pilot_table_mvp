import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import FlightTable from '../../components/FlightsTable';
import FlightsStats from '../../components/FlightsStats';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export default function WebApp() {
  const [user, setUser] = useState(null);
  useEffect(()=>{
    const tg = window.Telegram?.WebApp;
    if(tg){ tg.expand?.(); const tgUser = tg.initDataUnsafe?.user; if(tgUser) setUser({ tg_id: tgUser.id, name: tgUser.first_name }); }
  },[]);
  return (<div className="min-h-screen p-4">
    <header className="flex items-center space-x-3 mb-4"><div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center">✈️</div><h1 className="text-xl font-semibold">Flights Dashboard</h1></header>
    <main><FlightTable user={user} supabaseClient={supabase} /><FlightsStats supabaseClient={supabase} /></main>
  </div>);
}