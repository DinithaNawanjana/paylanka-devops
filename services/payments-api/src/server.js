import express from 'express';
import cors from 'cors';
import pino from 'pino';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();
const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(cors());

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: +(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'payments-api', ts: new Date().toISOString() }));

app.get('/api/payments', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payments ORDER BY id DESC LIMIT 100');
    res.json(rows);
  } catch (e) {
    req.log?.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/payments', async (req, res) => {
  const { reference, amount_cents, currency } = req.body || {};
  if (!reference || !amount_cents) return res.status(400).json({ error: 'reference & amount_cents required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO payments(reference, amount_cents, currency, status) VALUES(,,COALESCE(,\'LKR\'),\'SUCCESS\') RETURNING *',
      [reference, amount_cents, currency]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

const port = +(process.env.PORT || 8000);
app.listen(port, () => logger.info(payments-api listening on :));
