process.env.LEGACY_ADMIN_SECRET_ENABLED = 'true';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { sanitizeContent, plainText } from '../server-lib/news-content.js';
import { verifySecret, rateLimit } from '../server-lib/security.js';
import { readBody } from '../server-lib/body.js';

process.env.NEWS_ADMIN_SECRET = 'synthetic-news-only';
process.env.PARCEL_UPDATES_SECRET = 'synthetic-parcel-only';
process.env.TRACK17_KEY = 'synthetic-provider-only';
const news = (await import('../api/news.js')).default;
const post = (await import('../api/news-post.js')).default;
const parcel = (await import('../api/parcel-updates.js')).default;
const track = (await import('../api/track.js')).default;
let client = 0;
async function call(handler, { method = 'POST', body = {}, query = {}, headers = {}, ip } = {}) {
  const req = { method, body, query, headers, socket: { remoteAddress: ip || `security-${client++}` } };
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; }, end() {} };
  await handler(req, res);
  return res;
}

test('allowlist preserves formatting and safe links, removes active markup and URLs', () => {
  const attacks = [
    '<p onclick="alert(1)">OK<strong>Bold</strong></p><script>alert(1)</script>',
    '<svg><a xlink:href="javascript:alert(1)">X</a></svg><math><mtext><img src=x onerror=alert(1)></mtext></math>',
    '<a href="jav&#x61;script:alert(1)">link</a><img src="data:image/svg+xml,bad" onerror="alert(1)">',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe><object data="x"></object>',
    '<form id="loginSecret"><input name="secretKey"></form><p style="background:url(javascript:alert(1))">text</p>',
    '<a href="java&#10;script:alert(1)">link</a><a href="//evil.invalid">other</a>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">'
  ];
  for (const dirty of attacks) {
    const clean = sanitizeContent(dirty);
    assert.doesNotMatch(clean, /<(?:script|svg|math|iframe|object|form|input|style)\b|\bon(?:click|error)=|\b(?:style|id|name)=|(?:href|src)="(?:javascript:|data:|\/\/)/i);
    assert.equal(sanitizeContent(clean), clean, 'sanitization is stable');
  }
  assert.match(sanitizeContent(attacks[0]), /<p>OK<strong>Bold<\/strong><\/p>/);
  assert.match(sanitizeContent('<a href="https://example.com">Safe</a><img src="/img/photo.png" alt="A &quot;quote&quot;">'), /href="https:\/\/example.com"/);
  assert.equal(plainText('<img src=x onerror=alert(1)>Title <b>text</b><script>bad</script>'), 'Title text');
});

test('credentials are independent, fail closed, and verified before API unlock', async () => {
  assert.equal(verifySecret('', ''), false);
  assert.equal(verifySecret({}, 'secret'), false);
  assert.equal(verifySecret('short', 'longer-secret'), false);
  for (const [handler, secret, other] of [[news, process.env.NEWS_ADMIN_SECRET, process.env.PARCEL_UPDATES_SECRET], [parcel, process.env.PARCEL_UPDATES_SECRET, process.env.NEWS_ADMIN_SECRET]]) {
    for (const supplied of ['', 'wrong', other, {}]) assert.equal((await call(handler, { body: { action: 'verify', secret: supplied } })).statusCode, 401);
    const result = await call(handler, { body: { action: 'verify', secret } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { authenticated: true });
  }
  const clientScript = readFileSync('public/js/news-admin.js', 'utf8');
  assert.doesNotMatch(clientScript, /sessionStorage\.setItem|\.innerHTML/);
  assert.ok(clientScript.indexOf('if (!response.ok) throw new Error();') < clientScript.lastIndexOf('showAdmin();'));
});

test('sanitization runs on preview, database writes and legacy database reads', async () => {
  const dirty = '<p onclick="bad()">Body</p><script>bad()</script>';
  const secret = process.env.NEWS_ADMIN_SECRET;
  const preview = await call(news, { body: { action: 'preview', secret, contentHtml: dirty } });
  assert.equal(preview.body.contentHtml, '<p>Body</p>');
  globalThis.sqlQueue = [{ match: 'insert into news', values: ['Title', null, null, '<p>Body</p>', 'title', null], rows: [{ id: 1, title: '<b>Title</b>' }] }];
  const written = await call(news, { body: { secret, title: '<b>Title</b>', contentHtml: dirty } });
  assert.equal(written.statusCode, 200);
  assert.equal(written.body.post.title, 'Title');
  globalThis.sqlQueue = [{ match: 'where id = .*published_at is not null and published_at <= now', values: [1, false], rows: [{ id: 1, title: '<img src=x>Old', contentHtml: dirty }] }];
  const read = await call(post, { method: 'GET', query: { id: '1' } });
  assert.equal(read.body.post.title, 'Old');
  assert.equal(read.body.post.contentHtml, '<p>Body</p>');
});

test('public list and id/slug queries enforce publication; staff credentials are required for drafts', async () => {
  for (const headers of [{}, { 'x-admin-secret': 'wrong' }, { 'x-admin-secret': process.env.PARCEL_UPDATES_SECRET }, { 'x-admin-secret': process.env.NEWS_ADMIN_SECRET }]) {
    const staff = headers['x-admin-secret'] === process.env.NEWS_ADMIN_SECRET;
    globalThis.sqlQueue = [{ match: 'where.*published_at is not null and published_at <= now\\(\\)', values: [staff, 6, 0], rows: [] }];
    const list = await call(news, { method: 'GET', headers });
    assert.equal(list.statusCode, 200);
    assert.equal(list.headers['Cache-Control'], 'no-store');
    for (const query of [{ id: '1' }, { slug: 'draft' }]) {
      globalThis.sqlQueue = [{ match: 'where.*published_at is not null and published_at <= now\\(\\)', values: [query.id ? 1 : 'draft', staff], rows: [] }];
      assert.equal((await call(post, { method: 'GET', query, headers })).statusCode, 404);
    }
  }
});

test('all APIs reject foreign origins and only allow the configured site origin', async () => {
  for (const handler of [news, post, parcel, track, (await import('../api/carriers.js')).default]) {
    const denied = await call(handler, { method: 'OPTIONS', headers: { origin: 'https://evil.invalid' } });
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.headers['Access-Control-Allow-Origin'], undefined);
    const allowed = await call(handler, { method: 'OPTIONS', headers: { origin: 'https://www.hltrungviet.com' } });
    assert.equal(allowed.statusCode, 204);
    assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://www.hltrungviet.com');
    assert.equal(allowed.headers.Vary, 'Origin');
  }
});

test('tracking rejects malformed inputs before contacting provider, throttles repeated requests', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Provider must not be called'); };
  try {
    for (const body of [{}, { number: 123 }, { number: '<script>' }, { number: 'A'.repeat(81) }, { number: 'ABC123', carrier: {} }, { number: 'ABC123', carrierText: [] }, { number: 'ABC123', carrierText: 'x'.repeat(101) }]) {
      assert.equal((await call(track, { body })).statusCode, 400);
    }
    for (let i = 0; i < 10; i++) assert.equal((await call(track, { ip: 'limit-fixture', body: {} })).statusCode, 400);
    const limited = await call(track, { ip: 'limit-fixture', body: {} });
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['Retry-After'], '60');
  } finally { globalThis.fetch = original; }
});

test('rate limit window expires and body limits cover parsed and streamed inputs', async () => {
  const req = { socket: { remoteAddress: 'clock-fixture' } };
  const res = { setHeader() {}, status() { return this; }, json() {} };
  assert.equal(rateLimit(req, res, 'clock', 1, 1000), true);
  assert.equal(rateLimit(req, res, 'clock', 1, 1001), false);
  assert.equal(rateLimit(req, res, 'clock', 1, 61000), true);
  for (const req of [{ body: { value: 'x'.repeat(5000) } }, { body: Buffer.alloc(5000) }, { body: 'x'.repeat(5000) }, Readable.from(['x'.repeat(3000), 'x'.repeat(3000)])]) {
    await assert.rejects(readBody(req, 4096), /Invalid request/);
  }
});

test('database exceptions and provider exceptions do not leak details', async () => {
  globalThis.sqlQueue = [{ match: 'from news', error: 'postgres://private-credential/internal' }];
  const result = await call(news, { method: 'GET' });
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: 'Request failed' });
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.redirect, 'error');
    throw new Error('private-provider-detail');
  };
  try {
    const result = await call(track, { body: { number: 'ABC123' } });
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, { error: 'Request failed' });
  } finally { globalThis.fetch = original; }
});

test('deployment headers restrict scripts and framing while preserving scanner access', () => {
  const config = JSON.parse(readFileSync('vercel.json'));
  const headers = Object.fromEntries(config.headers[0].headers.map(item => [item.key, item.value]));
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(headers['Permissions-Policy'], /camera=\(self\)/);
  assert.match(headers['Content-Security-Policy'], /script-src 'self';/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
});

test('already-registered parcels can be read without deleting provider registrations', async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    return { ok: true, json: async () => url.endsWith('/register') ?
      { code: 0, data: { rejected: [{ error: { code: -18019901, message: 'Already registered' } }] } } :
      { code: 0, data: { accepted: [{ number: 'ABC123', track_info: {} }] } } };
  };
  try {
    const result = await call(track, { body: { number: 'ABC123' } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.info.data.accepted[0].number, 'ABC123');
    assert.deepEqual(urls.map(url => new URL(url).pathname.split('/').at(-1)), ['register', 'gettrackinfo']);
    assert.equal(result.body.stop, null);
  } finally { globalThis.fetch = original; }
});
