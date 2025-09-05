import { supabaseServer } from "../../lib/supabaseServer";
import { sendMessage } from "../../lib/telegram";

/**
 * Получение пользователя по tg_id (для проверки роли)
 */
async function getUser(tg_id) {
  const { data, error } = await supabaseServer
    .from("users")
    .select("*")
    .eq("tg_id", tg_id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Добавление записи в audit_log
 */
async function logAction(user_id, action, details) {
  await supabaseServer.from("audit_log").insert({
    user_id,
    action,
    details,
  });
}

export default async function handler(req, res) {
  const { method, body, query, headers } = req;

  // tg_id должен приходить из заголовка (или токена в будущем)
  const tg_id = headers["x-telegram-id"];
  if (!tg_id) return res.status(401).json({ error: "Missing x-telegram-id header" });

  let user;
  try {
    user = await getUser(tg_id);
  } catch (e) {
    return res.status(403).json({ error: "User not found" });
  }

  try {
    if (method === "GET") {
      // Все роли могут просматривать полеты, но поля фильтруются
      let { data, error } = await supabaseServer.from("flights").select("*");
      if (error) throw error;

      // Пилот и менеджер не видят costs/revenue
      if (user.role === "pilot" || user.role === "manager") {
        data = data.map((f) => {
          const { costs, revenue, ...rest } = f;
          return rest;
        });
      }

      return res.status(200).json(data);
    }

    if (method === "POST") {
      if (user.role === "pilot" || user.role === "accountant") {
        return res.status(403).json({ error: "Нет прав для создания рейса" });
      }

      const newFlight = { ...body, created_by: tg_id };
      const { data, error } = await supabaseServer
        .from("flights")
        .insert([newFlight])
        .select()
        .single();

      if (error) throw error;
      await logAction(tg_id, "create_flight", { flight_id: data.id });

      return res.status(201).json(data);
    }

    if (method === "PUT") {
    const { id, ...rest } = body;

    const { data: oldFlight } = await supabaseServer
        .from("flights")
        .select("*")
        .eq("id", id)
        .single();

    if (!oldFlight) return res.status(404).json({ error: "Flight not found" });

    let updates = { ...rest };

    // Проверка по ролям
    if (user.role === "pilot") {
        // Пилот может менять только комментарий пилота и статус
        updates = {
        pilot_comment: rest.pilot_comment ?? oldFlight.pilot_comment,
        status: rest.status ?? oldFlight.status,
        };
    } else if (user.role === "manager") {
        // Менеджер не редактирует costs/revenue
        delete updates.costs;
        delete updates.revenue;
    } else if (user.role === "accountant") {
        // Бухгалтер редактирует только costs/revenue
        updates = {
        costs: rest.costs ?? oldFlight.costs,
        revenue: rest.revenue ?? oldFlight.revenue,
        };
    }
    // Admin может всё

    const { data, error } = await supabaseServer
        .from("flights")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;

    await logAction(tg_id, "update_flight", { flight_id: id, updates });

    // Push уведомления при смене статуса
    if (updates.status && updates.status !== oldFlight.status) {
        await sendMessage(
        oldFlight.created_by,
        `Статус полёта ${oldFlight.route} изменен на ${updates.status}`
        );
    }

    return res.status(200).json(data);
    }


    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}