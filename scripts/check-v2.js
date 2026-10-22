import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
function files(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
assert.equal(files('public').filter(p => /\.(jpe?g|webp)$/i.test(p)).length,0,'Photos must not be public assets');
for (const route of ['index','contact','track','parcel-updates','admin-parcels','about','service','feature','price','team','testimonial','news','404']) {
 const html = readFileSync(`dist/${route}.html`,'utf8');
 assert.doesNotMatch(html,/google\.com\/maps|<iframe/);
 assert.doesNotMatch(html,/<input[^>]*type="password"/);
 if (['index','contact'].includes(route)) {
  assert.match(html,/class="honeypot" aria-hidden="true"/);
  assert.match(html,/<input[^>]*name="website"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
 }
 for (const match of html.matchAll(/<img[^>]*src="([^"]+\.(?:webp|jpe?g))"/g)) assert.match(match[1],/^\/_astro\//);
}
const sharp = (await import('sharp')).default;
for (const file of files('dist/_astro').filter(f => /\.(webp|jpe?g)$/i.test(f))) {
 const meta = await sharp(file).metadata();
 assert.equal(meta.exif,undefined,`${file}: EXIF must be stripped`);
 assert.equal(meta.xmp,undefined,`${file}: XMP must be stripped`);
}
console.log('V2 image pipeline, metadata removal, honeypots, static maps and secret-free parcel UI verified.');
