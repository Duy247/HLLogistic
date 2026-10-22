import fs from 'node:fs';

// Development middleware uses the production handlers, never a second backend.
export function localApi() {
  return {
    name: 'hll-local-api',
    async configureServer(server) {
      if (fs.existsSync('.env')) process.loadEnvFile('.env');
      const names = ['carriers', 'track', 'parcel-updates', 'news', 'news-post'];
      const handlers = Object.fromEntries(await Promise.all(names.map(async name =>
        [`/api/${name}`, (await import(`../api/${name}.js`)).default])));
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const handler = handlers[url.pathname];
        if (!handler) {
          // Match static build.format=file URLs during Astro development too.
          if (/^\/[^/]+\.html$/.test(url.pathname)) {
            url.pathname = url.pathname === '/index.html' ? '/' : url.pathname.slice(0, -5);
            req.url = url.pathname + url.search;
          }
          return next();
        }
        req.query = Object.fromEntries([...new Set(url.searchParams.keys())].map(key => {
          const values = url.searchParams.getAll(key);
          return [key, values.length === 1 ? values[0] : values];
        }));
        res.status = code => { res.statusCode = code; return res; };
        res.json = payload => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
        };
        try { await handler(req, res); }
        catch (error) { res.status(500).json({ error: error.message || 'Unknown error' }); }
      });
    },
  };
}
