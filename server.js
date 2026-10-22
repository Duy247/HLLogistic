import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root); // Carrier handlers resolve their bundled catalog from cwd.
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));

// Import after loading env: news and parcel handlers capture their secret at import.
const handlers = Object.fromEntries(await Promise.all(
  ['track', 'carriers', 'parcel-updates', 'news', 'news-post'].map(async name =>
    [`/api/${name}`, (await import(`./api/${name}.js`)).default])
));
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.map': 'application/json'
};
const staticRoot = path.join(root, 'dist');
const publicDirs = new Set(['assets', 'carriers', 'css', 'img', 'js', 'lib', 'partials']);

const server = http.createServer(async (req, res) => {
  res.status = code => { res.statusCode = code; return res; };
  res.json = payload => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };
  try {
    const url = new URL(req.url, 'http://localhost');
    const handler = handlers[url.pathname];
    if (handler) {
      req.query = Object.fromEntries([...new Set(url.searchParams.keys())].map(key => {
        const values = url.searchParams.getAll(key);
        return [key, values.length === 1 ? values[0] : values];
      }));
      await handler(req, res);
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const parts = relative.split('/');
    const publicFile = (parts.length === 1 && relative.endsWith('.html')) || publicDirs.has(parts[0]) || ['favicon-tile.svg', 'apple-touch-icon.png'].includes(relative);
    const filename = path.resolve(staticRoot, relative);
    const contained = filename.startsWith(staticRoot + path.sep);
    if (!['GET', 'HEAD'].includes(req.method) || !publicFile || !contained ||
        parts.some(part => part.startsWith('.')) || !fs.existsSync(filename) ||
        !fs.statSync(filename).isFile() || !fs.realpathSync(filename).startsWith(staticRoot + path.sep)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(filename).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
});
server.listen(process.env.PORT || 3000, '127.0.0.1', () => {
  console.log(`Server listening on http://localhost:${server.address().port}`);
});
