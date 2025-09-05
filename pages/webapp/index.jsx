import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CSVLink } from "react-csv";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

export default function WebApp() {
  const [user, setUser] = useState(null);
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState([null, null]);

  // Инициализация Telegram WebApp
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const tgUser = tg?.initDataUnsafe?.user || { id: 999, first_name: "LocalDev", username: "local_user" };
    setUser(tgUser);

    // Проверяем или создаём пользователя в Supabase
    (async () => {
      try {
        const { data, error: fetchError } = await supabaseClient
          .from("users")
          .select("*")
          .eq("tg_id", tgUser.id)
          .single();

        if (fetchError) {
          await supabaseClient.from("users").insert({
            tg_id: tgUser.id,
            full_name: tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : ""),
            role: "pilot",
          });
        }
      } catch (err) {
        console.error(err);
        setError("Ошибка при проверке пользователя");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Загрузка полётов
  useEffect(() => {
    if (!user) return;
    const fetchFlights = async () => {
      try {
        let query = supabaseClient.from("flights").select("*");
        const { data, error } = await query;
        if (error) throw error;
        setFlights(data);
      } catch (err) {
        console.error(err);
        setError("Ошибка при загрузке полётов");
      }
    };
    fetchFlights();
  }, [user]);

  // Фильтрация и поиск
  const filteredFlights = flights.filter(f => {
    const matchesSearch = f.route.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? f.status === statusFilter : true;
    const matchesDate =
      (!dateRange[0] || new Date(f.flight_date) >= dateRange[0]) &&
      (!dateRange[1] || new Date(f.flight_date) <= dateRange[1]);
    return matchesSearch && matchesStatus && matchesDate;
  });

  // CSV export
  const csvData = filteredFlights.map(f => ({
    id: f.id,
    flight_date: f.flight_date,
    route: f.route,
    costs: f.costs,
    revenue: f.revenue,
    status: f.status,
    manager_comment: f.manager_comment,
    pilot_comment: f.pilot_comment,
  }));

  // Статистика для графика
  const chartData = filteredFlights.map(f => ({
    date: f.flight_date,
    costs: parseFloat(f.costs || 0),
    revenue: parseFloat(f.revenue || 0),
  }));

  if (loading) return <div className="p-4">Загрузка...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Привет, {user.first_name}!</h1>

      {/* Панель фильтров */}
      <div className="flex flex-col md:flex-row items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Поиск по маршруту"
          className="border rounded p-2 flex-1"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded p-2">
          <option value="">Все статусы</option>
          <option value="planned">Запланирован</option>
          <option value="in_progress">Выполняется</option>
          <option value="done">Выполнен</option>
          <option value="cancelled">Отменен</option>
        </select>
        <DatePicker
          selectsRange
          startDate={dateRange[0]}
          endDate={dateRange[1]}
          onChange={update => setDateRange(update)}
          isClearable
          className="border rounded p-2"
        />
        <CSVLink data={csvData} filename="flights.csv" className="px-4 py-2 bg-sky-500 text-white rounded">
          Экспорт CSV
        </CSVLink>
      </div>

      {/* Таблица полётов */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Дата</th>
              <th className="border p-2">Маршрут</th>
              <th className="border p-2">Статус</th>
              <th className="border p-2">Комментарий менеджера</th>
              <th className="border p-2">Комментарий пилота</th>
            </tr>
          </thead>
          <tbody>
            {filteredFlights.map(f => (
              <tr key={f.id}>
                <td className="border p-2">{f.flight_date}</td>
                <td className="border p-2">{f.route}</td>
                <td className="border p-2">{f.status}</td>
                <td className="border p-2">{f.manager_comment}</td>
                <td className="border p-2">{f.pilot_comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* График прибыли/затрат */}
      <h2 className="text-lg font-semibold mt-6 mb-2">Статистика прибыли/затрат</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="revenue" stroke="#10B981" name="Прибыль" />
          <Line type="monotone" dataKey="costs" stroke="#EF4444" name="Затраты" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}