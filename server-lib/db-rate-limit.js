import { createHash } from 'node:crypto';
import { sql } from '@vercel/postgres';
function positive(value, fallback) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : fallback; }
export async function databaseRateLimit(req, res, scope = 'track', username) {
  const ip = process.env.VERCEL ? req.headers?.['x-real-ip'] || 'unknown' : req.socket?.remoteAddress || 'unknown';
  const key = createHash('sha256').update(String(ip)).digest('hex');
  const login = scope === 'admin-login' || scope === 'admin-login-username';
  const prefix = login ? 'ADMIN_LOGIN_RATE' : 'TRACK_RATE';
  const window = positive(process.env[`${prefix}_WINDOW_SECONDS`], login ? 900 : 60);
  const ipLimit = login
    ? Math.min(positive(process.env.ADMIN_LOGIN_RATE_IP_LIMIT, 5), 2147483646)
    : positive(process.env.TRACK_RATE_IP_LIMIT, 10);
  const perIp = scope === 'admin-login-username'
    ? Math.max(ipLimit + 1, positive(process.env.ADMIN_LOGIN_RATE_USERNAME_LIMIT, 10))
    : ipLimit;
  const global = positive(process.env[`${prefix}_GLOBAL_LIMIT`], 200);
  const bucket = scope === 'admin-login-username'
    ? createHash('sha256').update(username).digest('hex') : key;
  try {
    const { rows } = await sql`select * from consume_rate_limit(${scope}, ${bucket}, ${window}, ${perIp}, ${global})`;
    if (rows[0]?.allowed === true) return true;
    if (scope === 'admin-login-username') console.warn(`Admin login username lockout: ${JSON.stringify(username)}`);
    res.setHeader('Retry-After', String(Math.max(1, Number(rows[0]?.retry_after) || window)));
    res.status(429).json({ error: 'Too many requests' });
  } catch { res.status(503).json({ error: 'Service unavailable' }); }
  return false;
}
