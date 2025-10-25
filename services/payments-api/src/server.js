import express from "express";
import cors from "cors";
import pino from "pino";
import pinoHttp from "pino-http";
import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(cors());

const pool = new Pool({
  host: process.env.PGHOST || "db",
  port: +(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "paylanka",
  password: process.env.PGPASSWORD || "paylanka",
  database: process.env.PGDATABASE || "paylanka",
  max: 10,
  idleTimeoutMillis: 30000
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "payments-api", ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: "DB unreachable", detail: String(e) });
  }
});

app.get("/api/payments", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || "100", 10) || 100, 500));
  try {
    let sql = "SELECT * FROM payments";
    const params = [];
    if (q) { sql += " WHERE reference ILIKE $1"; params.push(`%${q}%`); }
    sql += " ORDER BY id DESC LIMIT " + limit;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error", detail: String(e) });
  }
});

app.get("/api/summary", async (_req, res) => {
  try {
    const countRes = await pool.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_cents),0)::bigint AS sum_cents FROM payments");
    const seriesRes = await pool.query("SELECT id, reference, amount_cents, created_at FROM payments ORDER BY id DESC LIMIT 7");
    const row = countRes.rows[0] || { count: 0, sum_cents: 0 };
    const sum_cents = Number(row.sum_cents || 0);
    const last7 = (seriesRes.rows || []).map(r => ({ ...r, amount_cents: Number(r.amount_cents || 0) }));
    res.json({ count: Number(row.count || 0), sum_cents, last7 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error", detail: String(e) });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    let { reference, amount_cents, currency } = req.body || {};
    reference = (reference || "").toString().trim();
    amount_cents = Number(amount_cents);
    if (!reference) return res.status(400).json({ error: "reference required" });
    if (!Number.isFinite(amount_cents)) return res.status(400).json({ error: "amount_cents must be a number (in cents)" });
    amount_cents = Math.round(amount_cents);
    if (amount_cents <= 0) return res.status(400).json({ error: "amount_cents must be > 0" });
    currency = (currency || "LKR").toString();

    const { rows } = await pool.query(
      "INSERT INTO payments(reference, amount_cents, currency, status) VALUES($1,$2,$3,'SUCCESS') RETURNING *",
      [reference, amount_cents, currency]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error", detail: String(e) });
  }
});

app.delete("/api/payments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid id" });
    const { rowCount } = await pool.query("DELETE FROM payments WHERE id=$1", [id]);
    res.json({ deleted: rowCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error", detail: String(e) });
  }
});

const port = +(process.env.PORT || 8000);
app.listen(port, () => logger.info(`payments-api listening on :${port}`));
