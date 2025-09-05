import { useEffect, useState } from 'react';
import FlightsTable from '../../components/FlightsTable';
import FlightsStats from '../../components/FlightsStats';
import RoleManagement from '../../components/RoleManagement';
import { apiFetch } from '../../lib/apiClient';

export default function WebAppPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('pilot');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tg = typeof window !== 'undefined' && window.Telegram?.WebApp;
    tg?.expand?.();
    const telegramUser = tg?.initDataUnsafe?.user;
    if (telegramUser) {
      setUser(telegramUser);
      // fetch role from server
      apiFetch(`/api/users?tg_id=${telegramUser.id}`)
        .then(res => { setRole(res.user?.role || 'pilot'); })
        .catch(err => { console.error('get role error', err); })
        .finally(()=> setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="p-4">Загрузка...</div>;
  if (!user) return <div className="p-4 text-red-600">Не удалось получить пользователя Telegram</div>;

  return (
    <div className="p-4">
      <header className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center">✈️</div>
        <div>
          <div className="text-lg font-semibold">Flights Dashboard</div>
          <div className="text-sm text-gray-600">{user.first_name} {user.last_name || ''} — {user.username || 'no username'}</div>
        </div>
      </header>

      <div className="space-y-6">
        <FlightsTable user={user} role={role} />
        {(role === 'admin' || role === 'accountant') && <FlightsStats />}
        {role === 'admin' && <RoleManagement user={user} />}
      </div>
    </div>
  );
}