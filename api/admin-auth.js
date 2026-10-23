import { sql } from '@vercel/postgres';
import { allowCors } from '../server-lib/security.js';
import { readBody } from '../server-lib/body.js';
import { checkPassword, sessionCookie, clearSessionCookie, sessionUser, signingKey } from '../server-lib/admin-auth.js';
import { databaseRateLimit } from '../server-lib/db-rate-limit.js';
export default async function handler(req, res) {
  if (!allowCors(req, res, 'GET,POST,OPTIONS')) return;
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const user = await sessionUser(req);
      return res.status(user ? 200 : 401).json({ authenticated: !!user });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    signingKey(); // Reject invalid signing configuration before login/logout work.
    const body = await readBody(req, 4096);
    if (body.action === 'logout') {
      const user = await sessionUser(req);
      if (user) await sql`update admin_users set session_version = session_version + 1 where id = ${user.id}`;
      res.setHeader('Set-Cookie', clearSessionCookie());
      return res.status(200).json({ authenticated: false });
    }
    if (!await databaseRateLimit(req, res, 'admin-login')) return;
    if (typeof body.username !== 'string' || body.username.length > 100 || typeof body.password !== 'string' || body.password.length > 1024) return res.status(401).json({ error: 'Invalid credentials' });
    const username = body.username.trim().toLowerCase();
    if (!await databaseRateLimit(req, res, 'admin-login-username', username)) return;
    const { rows } = await sql`select id, password_hash, session_version from admin_users where username = ${username} and enabled = true`;
    const user = rows[0];
    if (!await checkPassword(body.password, user?.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    const { rows: renewed } = await sql`update admin_users set session_version = session_version + 1 where id = ${user.id} and enabled = true returning id, session_version`;
    if (!renewed[0]) return res.status(401).json({ error: 'Invalid credentials' });
    res.setHeader('Set-Cookie', sessionCookie(renewed[0]));
    return res.status(200).json({ authenticated: true });
  } catch { return res.status(503).json({ error: 'Service unavailable' }); }
}
