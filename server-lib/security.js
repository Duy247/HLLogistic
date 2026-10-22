import { createHash, timingSafeEqual } from 'node:crypto';

export function verifySecret(provided, expected) {
  const digest = value => createHash('sha256').update(value).digest();
  return typeof provided === 'string' && typeof expected === 'string' && !!expected &&
    timingSafeEqual(digest(provided), digest(expected));
}

export function allowCors(req, res, methods) {
  const origin = process.env.SITE_ORIGIN || 'https://www.hltrungviet.com';
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
  if (req.headers?.origin && req.headers.origin !== origin) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  if (req.headers?.origin === origin) res.setHeader('Access-Control-Allow-Origin', origin);
  return true;
}

// Per warm server instance. Configure an edge rate limit as well for a fleet-wide budget.
const buckets = new Map();
export function rateLimit(req, res, scope, limit = 10, now = Date.now()) {
  // Vercel overwrites x-real-ip. Do not trust caller-supplied x-forwarded-for.
  const ip = process.env.VERCEL ? req.headers?.['x-real-ip'] || 'unknown' : req.socket?.remoteAddress || 'local';
  for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const keys = [[`${scope}:${ip}`, limit], [`${scope}:global`, limit * 20]];
  for (const [key, max] of keys) {
    const bucket = buckets.get(key);
    if ((bucket?.count || 0) >= max || buckets.size > 10000) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: 'Too many requests' });
      return false;
    }
  }
  for (const [key] of keys) {
    const bucket = buckets.get(key) || { count: 0, until: now + 60000 };
    bucket.count++;
    buckets.set(key, bucket);
  }
  return true;
}
