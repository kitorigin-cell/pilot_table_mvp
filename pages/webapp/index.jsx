import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";

export default function WebApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      setError("Telegram WebApp не найден. Откройте мини-приложение через Telegram.");
      setLoading(false);
      return;
    }

    tg.ready();
    tg.expand();

    // Получаем пользователя Telegram
    const tgUser = tg.initDataUnsafe?.user;

    if (!tgUser) {
      console.error("Telegram user не найден в initDataUnsafe");
      setError("Не удалось получить пользователя Telegram");
      setLoading(false);
      return;
    }

    // Сохраняем локально
    setUser(tgUser);

    // Проверяем пользователя в Supabase
    (async () => {
      try {
        const { data, error: fetchError } = await supabaseClient
          .from("users")
          .select("*")
          .eq("tg_id", tgUser.id)
          .single();

        if (fetchError && fetchError.code === "PGRST116") {
          // Пользователь не найден — создаём нового с ролью pilot
          const { data: newUser, error: insertError } = await supabaseClient
            .from("users")
            .insert({
              tg_id: tgUser.id,
              full_name: tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : ""),
              role: "pilot",
            })
            .select()
            .single();

          if (insertError) throw insertError;

          console.log("Создан новый пользователь:", newUser);
        } else if (fetchError) {
          throw fetchError;
        } else {
          console.log("Пользователь найден:", data);
        }
      } catch (err) {
        console.error("Ошибка при проверке/создании пользователя:", err.message);
        setError("Ошибка при получении данных пользователя");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-4">Загрузка...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Привет, {user.first_name}!</h1>
      <p>Добро пожаловать в мини-приложение для управления полётами.</p>

      {/* Пример UI для пилота */}
      <div className="mt-6 border rounded p-4 shadow-sm">
        <h2 className="font-semibold mb-2">Ваша роль:</h2>
        <p className="mb-2">
          {user.role ? user.role.toUpperCase() : "Pilot (по умолчанию)"}
        </p>

        <p className="text-sm text-gray-500">
          Здесь можно просматривать рейсы, оставлять комментарии и изменять статус.
        </p>
      </div>
    </div>
  );
}