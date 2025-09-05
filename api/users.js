const BASE_ID = process.env.AIRTABLE_BASE_ID;
const PAT = process.env.AIRTABLE_PAT;
const TABLE_NAME = "Users";

export default async function handler(req, res) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

  try {
    if (req.method === "GET") {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
      const data = await r.json();
      const users = data.records.map(r => ({ id: r.id, ...r.fields }));
      return res.json(users);
    }

    if (req.method === "POST") {
      // Добавление нового пользователя
      const { tg_id, username, role } = req.body;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PAT}` },
        body: JSON.stringify({ records: [{ fields: { tg_id, username, role } }] })
      });
      const data = await r.json();
      return res.status(201).json({ ok: true, id: data.records[0].id });
    }

    if (req.method === "PUT") {
      // Обновление роли
      const { id, role } = req.body;
      const r = await fetch(`${url}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PAT}` },
        body: JSON.stringify({ fields: { role } }),
      });
      const data = await r.json();
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
}