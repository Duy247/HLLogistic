import { randomBytes, scrypt as scryptCallback, createHmac, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { sql } from '@vercel/postgres';
import { verifySecret } from './security.js';
const scrypt = promisify(scryptCallback);
const COOKIE = '__Host-admin';
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${key.toString('hex')}`;
}
export async function checkPassword(password, hash) {
  let options = SCRYPT, salt = '0'.repeat(32), expected = '0'.repeat(128), valid = false;
  if (typeof hash === 'string' && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) {
    [, salt, expected] = hash.split(':');
    options = { ...SCRYPT, N: 2 ** 14 }; // Original Node scrypt defaults.
    valid = true;
  } else if (typeof hash === 'string') {
    const parts = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
    if (parts) {
      const N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
      // Bound stored parameters before allocating memory or CPU work.
      if ([32768, 65536, 131072].includes(N) && r === 8 && p === 1) {
        options = { N, r, p, maxmem: 256 * N * r };
        salt = parts[4]; expected = parts[5]; valid = true;
      }
    }
  }
  const actual = await scrypt(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && valid;
}
export function signingKey() {
  const key = process.env.ADMIN_SESSION_SECRET;
  if (typeof key !== 'string' || !/^[a-fA-F0-9]{64}$/.test(key)) throw new Error('Session configuration unavailable');
  return Buffer.from(key, 'hex');
}
function signature(value) { return createHmac('sha256', signingKey()).update(value).digest('base64url'); }
export function sessionCookie(user, now = Date.now()) {
  const seconds = Math.min(86400, Math.max(300, Number(process.env.ADMIN_SESSION_TTL_SECONDS) || 28800));
  const data = Buffer.from(JSON.stringify({ id: user.id, version: user.session_version, exp: Math.floor(now / 1000) + seconds, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${COOKIE}=${data}.${signature(data)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}
export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function sessionUser(req) {
  const token = req.headers?.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || token.length > 2048) return null;
  try {
    const [data, sig, extra] = token.split('.');
    if (extra || !verifySecret(sig, signature(data))) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
    const { rows } = await sql`select id, username, session_version from admin_users where id = ${payload.id} and enabled = true and session_version = ${payload.version}`;
    return rows[0] || null;
  } catch { return null; }
}
export async function isAdmin(req, secret, expected) {
  if (process.env.LEGACY_ADMIN_SECRET_ENABLED === 'true' && verifySecret(secret, expected)) return true;
  return !!(await sessionUser(req));
}
