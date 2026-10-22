import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('shared public navigation uses clean routes without exposing admin pages', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  for (const region of [html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0], html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0]]) {
    assert.ok(region);
    for (const route of ['/about', '/service', '/price', '/news', '/track', '/contact']) {
      assert.ok(region.includes(`href="${route}"`), `Missing ${route}`);
    }
    assert.match(region, /data-en="News"[^>]*>Tin tức<\/a>/);
    assert.doesNotMatch(region, /href="[^\"]*(?:\.html|news-admin|admin-parcels|parcel-updates)/);
  }
  assert.doesNotMatch(html, /href="\/parcel-updates"/);
  assert.equal(JSON.parse(readFileSync('vercel.json', 'utf8')).cleanUrls, true);
});

test('404 has one page-not-found heading', () => {
  const html = readFileSync('dist/404.html', 'utf8');
  assert.equal([...html.matchAll(/<h[1-6]\b[^>]*>Không tìm thấy trang<\/h[1-6]>/g)].length, 1);
});


test('staff pages discourage indexing and robots.txt permits public pages', () => {
  const robots = readFileSync('dist/robots.txt', 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  for (const route of ['news-admin', 'admin-parcels', 'parcel-updates', 'parcel-updates-mobile']) {
    const html = readFileSync(`dist/${route}.html`, 'utf8');
    const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
    assert.match(head, /<meta name="robots" content="noindex, nofollow"/);
    for (const suffix of ['', '.html']) assert.ok(robots.split('\n').includes(`Disallow: /${route}${suffix}`));
  }
});

test('removed public pages are absent from build output', () => {
  for (const route of ['feature', 'team', 'testimonial']) assert.equal(existsSync(`dist/${route}.html`), false);
});
