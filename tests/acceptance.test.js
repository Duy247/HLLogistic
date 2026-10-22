import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { readBody } from '../server-lib/body.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/acceptance.json', import.meta.url)));
// Synthetic test-only authorization markers, never copied from an environment.
process.env.PARCEL_UPDATES_SECRET = 'fixture-only';
process.env.NEWS_ADMIN_SECRET = 'fixture-only';
process.env.TRACK17_KEY = 'fixture-only';
const handlers = Object.fromEntries(await Promise.all(
  ['carriers', 'track', 'news', 'news-post', 'parcel-updates'].map(async name =>
    [name, (await import(`../api/${name}.js`)).default])
));

for (const fixture of fixtures.api) {
  test(fixture.name, async () => {
    for (const representation of fixture.body ? ['object', 'string', 'buffer', 'stream'] : ['stream']) {
      globalThis.sqlQueue = structuredClone(fixture.sql || []);
      const upstream = structuredClone(fixture.upstream || []);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        const expected = upstream.shift();
        assert.ok(expected, 'Unexpected provider request');
        assert.ok(url.endsWith(expected.path));
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(options.body), expected.body);
        return { ok: expected.status < 400, status: expected.status,
          statusText: expected.statusText || '', json: async () => expected.response };
      };
      const raw = fixture.raw ?? (fixture.body ? JSON.stringify(fixture.body) : '');
      const req = Readable.from(representation === 'stream' ? [raw] : []);
      req.socket = { remoteAddress: fixture.name + representation };
      req.method = fixture.method;
      req.query = fixture.query || {};
      if (representation === 'object') req.body = fixture.body;
      if (representation === 'string') req.body = raw;
      if (representation === 'buffer') req.body = Buffer.from(raw);
      const headers = {};
      const res = {
        status(code) { this.statusCode = code; return this; },
        setHeader(key, value) { headers[key] = value; },
        json(value) { this.body = value; }, end() {}
      };
      try {
        await handlers[fixture.handler](req, res);
        assert.equal(res.statusCode, fixture.status, representation);
        if (fixture.response) assert.deepEqual(res.body, fixture.response);
        if (fixture.catalog) assert.deepEqual(res.body, JSON.parse(readFileSync('carriers/apicarrier.all.json')));
        assert.equal(headers['Access-Control-Allow-Origin'], undefined);
        assert.equal(globalThis.sqlQueue.length, 0, 'Expected SQL not executed');
        assert.equal(upstream.length, 0, 'Expected provider request not executed');
      } finally { globalThis.fetch = originalFetch; }
    }
  });
}

test('body parsing preserves UTF-8 across split raw chunks and empty bodies', async () => {
  const raw = Buffer.from('{"event":"Nhập kho"}');
  const split = raw.indexOf(Buffer.from('ậ')) + 1;
  assert.deepEqual(await readBody(Readable.from([raw.subarray(0, split), raw.subarray(split)])), { event: 'Nhập kho' });
  assert.deepEqual(await readBody(Readable.from([])), {});
});

test('one local HTTP server serves page/query routes and all five handlers', async t => {
  if (!existsSync('dist/index.html')) {
    t.skip('Build output absent; run npm run check after installing dependencies');
    return;
  }
  // Managed sandboxes may deny even loopback sockets; expose that as a skip.
  const socketError = await new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', resolve);
    probe.listen(0, '127.0.0.1', () => probe.close(() => resolve(null)));
  });
  if (socketError) {
    if (['EPERM', 'EACCES'].includes(socketError.code)) {
      t.skip(`Loopback sockets denied: ${socketError.code}; HTTP/curl verification still required`);
      return;
    }
    throw socketError;
  }
  const env = { ...process.env, PORT: '0', TRACK17_KEY: '', PARCEL_UPDATES_SECRET: '' };
  const child = spawn(process.execPath, ['--import', './tests/register.js', 'server.js'],
    { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timeout: ' + stderr)), 10000);
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${stderr}`)); });
      child.stdout.on('data', chunk => {
        const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
      });
    });
    for (const route of fixtures.routes) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      const filename = new URL(route, base).pathname.slice(1) || 'index.html';
      assert.equal(await response.text(), readFileSync(`dist/${filename}`, 'utf8'), route);
    }
    for (const name of Object.keys(handlers)) {
      assert.equal((await fetch(`${base}/api/${name}`, { method: 'OPTIONS' })).status, 204, name);
    }
    assert.deepEqual(await (await fetch(base + '/api/carriers')).json(), JSON.parse(readFileSync('carriers/apicarrier.all.json')));
    assert.equal((await fetch(base + '/api/news-post')).status, 400);
    assert.equal((await fetch(base + '/api/news', { method: 'PATCH' })).status, 405);
    for (const route of ['/.env', '/package.json', '/api/news.js', '/server-lib/body.js', '/missing.html']) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }
});
