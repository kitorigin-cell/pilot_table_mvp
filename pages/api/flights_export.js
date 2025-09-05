import { supabaseServer } from "../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const { data, error } = await supabaseServer.from("flights").select("*");
  if (error) return res.status(500).json({ error: error.message });

  const header = [
    "id",
    "flight_date",
    "route",
    "costs",
    "revenue",
    "status",
    "manager_comment",
    "pilot_comment",
  ];

  const lines = [header.join(",")];

  data.forEach((r) =>
    lines.push(
      header
        .map(
          (h) =>
            '"' +
            ((r[h] || "") + "").replace(/"/g, '""') +
            '"'
        )
        .join(",")
    )
  );

  const csv = lines.join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=flights.csv");
  res.status(200).send(csv);
}