// client helper to call our API and attach x-telegram-id automatically
export async function apiFetch(path, options = {}) {
  const tg = typeof window !== 'undefined' && window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (userId) headers['x-telegram-id'] = String(userId);

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  try {
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    return json;
  } catch (e) {
    // parsing failed or error
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    return {};
  }
}