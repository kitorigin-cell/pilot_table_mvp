import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "users.json");

export default function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).end();

  const users = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const { tg_id, role } = req.body;

  const index = users.findIndex(u => u.tg_id == tg_id);
  if (index === -1) return res.status(404).json({ error: "User not found" });

  users[index].role = role;
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
  res.status(200).json({ ok: true });
}