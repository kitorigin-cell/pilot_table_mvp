import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "flights.json");

export default function handler(req, res) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (req.method === "GET") {
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const newFlight = { id: Date.now(), ...req.body };
    data.push(newFlight);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return res.status(201).json({ ok: true });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    const index = data.findIndex(f => f.id == id);
    if (index === -1) return res.status(404).json({ error: "Flight not found" });
    data[index] = { ...data[index], ...req.body };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}