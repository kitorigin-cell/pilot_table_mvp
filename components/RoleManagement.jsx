import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

export default function RoleManagement({ user }) {
  const [targetId, setTargetId] = useState('');
  const [role, setRole] = useState('pilot');
  const [actorId, setActorId] = useState(user?.id || '');
  const [message, setMessage] = useState('');

  useEffect(()=> {
    if (!actorId && typeof window !== 'undefined') {
      const tg = window.Telegram?.WebApp;
      setActorId(tg?.initDataUnsafe?.user?.id || '');
    }
  }, [actorId]);

  async function changeRole() {
    if (!targetId) return setMessage('Введите tg id цели');
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-telegram-id': actorId },
        body: JSON.stringify({ target_tg_id: Number(targetId), role, actor_tg_id: Number(actorId) })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка');
      setMessage('Роль изменена');
    } catch (e) {
      setMessage('Ошибка: ' + e.message);
    }
  }

  // Only render if current user is admin (server-side we also check)
  return (
    <div className="mt-6 p-3 border rounded">
      <h3 className="font-semibold mb-2">Управление ролями (Admin)</h3>
      <div className="flex gap-2 flex-col md:flex-row">
        <input className="border p-2 rounded" placeholder="target tg_id" value={targetId} onChange={e=>setTargetId(e.target.value)} />
        <select className="border p-2 rounded" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="pilot">pilot</option>
          <option value="manager">manager</option>
          <option value="accountant">accountant</option>
          <option value="admin">admin</option>
        </select>
        <button className="px-3 py-2 bg-sky-600 text-white rounded" onClick={changeRole}>Change</button>
      </div>
      {message && <div className="mt-2 text-sm text-gray-700">{message}</div>}
    </div>
  );
}