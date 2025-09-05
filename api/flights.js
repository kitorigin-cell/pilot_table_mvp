const BASE_ID = process.env.AIRTABLE_BASE_ID;
const PAT = process.env.AIRTABLE_PAT;
const TABLE_NAME = "Flights";

export default async function handler(req, res) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

  try {
    if (req.method === "GET") {
      console.log("url to Airtable:", url);
      console.log("Bearer to Airtable:", PAT);
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${PAT}` }
      });
      const data = await r.json();
      if (data.error) {
        return res.status(400).json({ error: data.error.message, details: data, url: url, pat:PAT });
      }
      const flights = data.records.map(r => ({ id: r.id, ...r.fields }));
      return res.json(flights);
    }

    if (req.method === "POST") {
      const body = req.body;

      // Проверяем обязательные поля
      if (!body.date || !body.route) {
        return res.status(400).json({ error: "Fields 'date' and 'route' are required", body });
      }

      // Приводим числа к Number
      body.income = Number(body.income) || 0;
      body.expense = Number(body.expense) || 0;

      console.log("POST body to Airtable:", body);

      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAT}`
        },
        body: JSON.stringify({ records: [{ fields: body }] }),
      });

      const data = await r.json();
      console.log("Airtable response:", data);

      if (data.error) {
        return res.status(400).json({ error: data.error.message, airtableResponse: data });
      }

      return res.status(201).json({ ok: true, id: data.records[0].id });
    }

    if (req.method === "PUT") {
      const { id, ...fields } = req.body;

      // Приводим числа к Number
      if (fields.income !== undefined) fields.income = Number(fields.income) || 0;
      if (fields.expense !== undefined) fields.expense = Number(fields.expense) || 0;

      console.log("PUT fields to Airtable:", fields);

      const r = await fetch(`${url}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAT}`
        },
        body: JSON.stringify({ fields }),
      });

      const data = await r.json();
      console.log("Airtable response:", data);

      if (data.error) {
        return res.status(400).json({ error: data.error.message, airtableResponse: data });
      }

      return res.json({ ok: true, data });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}