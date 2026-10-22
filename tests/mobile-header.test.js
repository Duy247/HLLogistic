import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('built mobile menu is external and supports disclosure, Escape and breakpoint reset', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.every(match => !match[2].trim()), 'No inline JavaScript');
  const src = scripts.map(match => match[1].match(/src="([^"]+)"/)?.[1]).find(path => path?.startsWith('/_astro/'));
  assert.ok(src, 'Bundled external component script');
  const handlers = {};
  const attrs = { 'aria-expanded': 'false' };
  let focused = false;
  let open = false;
  const header = { contains: node => node === toggle || node === menu };
  const toggle = {
    setAttribute: (key, value) => { attrs[key] = value; },
    getAttribute: key => attrs[key],
    addEventListener: (name, handler) => { handlers[`toggle:${name}`] = handler; },
    focus: () => { focused = true; },
    closest: () => header,
  };
  const menu = {
    classList: { toggle: (_, value) => { open = value; } },
    addEventListener: (name, handler) => { handlers[`menu:${name}`] = handler; },
  };
  const mobile = { matches: true, addEventListener: (_, handler) => { handlers.resize = handler; } };
  vm.runInNewContext(readFileSync(`dist${src}`, 'utf8'), {
    document: {
      querySelector: selector => selector === '.menu-toggle' ? toggle : menu,
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
    window: { matchMedia: () => mobile }, Element: class {}, Node: class {},
  });
  assert.equal(menu.inert, true);
  handlers['toggle:click']();
  assert.equal(attrs['aria-expanded'], 'true');
  assert.equal(open, true);
  assert.equal(menu.inert, false);
  handlers.keydown({ key: 'Escape' });
  assert.equal(attrs['aria-expanded'], 'false');
  assert.equal(menu.inert, true);
  assert.equal(focused, true);
  handlers['toggle:click']();
  mobile.matches = false;
  handlers.resize();
  assert.equal(open, false);
  assert.equal(menu.inert, false, 'Desktop navigation remains accessible');
});
