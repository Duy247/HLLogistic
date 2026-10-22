import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const fixtures = JSON.parse(readFileSync('tests/fixtures/acceptance.json'));
for (const route of fixtures.routes) {
  const pathname = new URL(route, 'https://fixture.invalid').pathname;
  const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
  const html = readFileSync(`dist/${filename}`, 'utf8');
  assert.match(html, /<html[^>]*lang="vi"/, route);
  assert.match(html, /favicon-tile\.svg/, route);
  assert.match(html, /apple-touch-icon\.png/, route);
  assert.doesNotMatch(html, /<div id="navbar"><\/div>/, route);
  assert.doesNotMatch(html, /src="js\/includes\.js"/, route);
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    const target = match[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(target)) continue;
    const pathname = new URL(target, 'https://fixture.invalid').pathname;
    const file = `dist/${pathname === '/' ? 'index.html' : pathname.slice(1)}`;
    assert.ok(existsSync(file) || (!/\.[^/]+$/.test(pathname) && existsSync(`${file}.html`)), `${route}: missing ${target}`);
  }
}
assert.deepEqual(readFileSync('dist/assets/logo-big.png'), readFileSync('public/assets/logo-big.png'));
// Compare catalog values so equivalent JSON Unicode escapes preserve the contract.
assert.deepEqual(JSON.parse(readFileSync('dist/carriers/apicarrier.all.json', 'utf8')),
  JSON.parse(readFileSync('carriers/apicarrier.all.json', 'utf8')));
console.log('Built legacy routes, linked assets, branding and carrier packaging verified.');
