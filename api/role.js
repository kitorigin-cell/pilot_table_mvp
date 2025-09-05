import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "users.json");

export default function handler(req, res) {
  const users = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const { tg_id } = req.query;
  const user = users.find(u => u.tg_id == tg_id);
  return res.status(200).json({ role: user ? user.role : "pilot" });
}