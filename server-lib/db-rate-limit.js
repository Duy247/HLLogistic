import { createHash } from 'node:crypto';
import { sql } from '@vercel/postgres';
function positive(value, fallback) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : fallback; }
export async function databaseRateLimit(req, res, scope = 'track') {
  const ip = process.env.VERCEL ? req.headers?.['x-real-ip'] || 'unknown' : req.socket?.remoteAddress || 'unknown';
  const key = createHash('sha256').update(String(ip)).digest('hex');
  const window = positive(process.env.TRACK_RATE_WINDOW_SECONDS, 60);
  const perIp = positive(process.env.TRACK_RATE_IP_LIMIT, 10);
  const global = positive(process.env.TRACK_RATE_GLOBAL_LIMIT, 200);
  try {
    const { rows } = await sql`select * from consume_rate_limit(${scope}, ${key}, ${window}, ${perIp}, ${global})`;
    if (rows[0]?.allowed === true) return true;
    res.setHeader('Retry-After', String(Math.max(1, Number(rows[0]?.retry_after) || window)));
    res.status(429).json({ error: 'Too many requests' });
  } catch { res.status(503).json({ error: 'Service unavailable' }); }
  return false;
}
