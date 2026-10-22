// Input: public-domain Natural Earth 1:50m admin-0 countries GeoJSON.
// Download https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
// Then: node scripts/generate-contact-map.js /path/to/ne_50m_admin_0_countries.geojson
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const input = readFileSync(process.argv[2]);
const project = ([lon, lat]) => [(lon - 100) * 420 / 18, (27 - lat) * 464 / 19];
// Sutherland–Hodgman rectangle clipping, before projection/simplification.
function clip(ring) {
  let points = ring.slice(0, -1);
  for (const [axis, edge, sign] of [[0,100,1],[0,118,-1],[1,8,1],[1,27,-1]]) {
    const output = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const insideA = sign * (a[axis] - edge) >= 0;
      const insideB = sign * (b[axis] - edge) >= 0;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        output.push(a.map((v, j) => v + t * (b[j] - v)));
      }
    }
    points = output;
  }
  return points.length ? [...points, points[0]].map(project) : [];
}
// Douglas–Peucker; maximum deviation 0.45 SVG units (~0.4px on mobile).
function simplify(points) {
  if (points.length <= 2) return points;
  const a = points[0], b = points.at(-1);
  let max = 0.45 ** 2, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], dx = b[0]-a[0], dy = b[1]-a[1];
    const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy || 1)));
    const d = (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
    if (d > max) { max = d; split = i; }
  }
  return split ? [...simplify(points.slice(0,split+1)).slice(0,-1), ...simplify(points.slice(split))] : [a,b];
}
const countries = JSON.parse(input).features
  .filter(f => ['Vietnam','China','Laos','Cambodia','Thailand','Myanmar'].includes(f.properties.ADMIN))
  .map(f => ({ name: f.properties.ADMIN, d: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
    .flatMap(polygon => polygon.map(clip).filter(r => r.length > 3).map(simplify)
      .filter(r => r.length > 3).map(r => 'M' + r.slice(0,-1).map(p => p.map(v => +v.toFixed(1)).join(',')).join('L') + 'Z')).join('') }));
const result = {
  source: 'Natural Earth 1:50m admin-0 countries (public domain)',
  url: 'https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson',
  inputSha256: createHash('sha256').update(input).digest('hex'),
  projection: 'Equirectangular, standard parallel ~17 degrees; bounds [100,8,118,27]; viewBox 0 0 420 464; tolerance 0.45',
  countries
};
writeFileSync('src/data/contact-map.json', JSON.stringify(result) + '\n');
console.log(`Generated ${countries.length} countries; ${JSON.stringify(result).length} characters`);
