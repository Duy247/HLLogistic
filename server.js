// Minimal proxy to 17TRACK Open API v2.4
// Usage: TRACK17_KEY=your_api_key node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        if (!line || line.trim().startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key && !process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnv();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TRACK17_KEY || '';
const BASE_V1 = 'https://api.17track.net/track/v1';
const BASE_V24 = 'https://api.17track.net/track/v2.4';
const CARRIER_FILE = path.join(process.cwd(), 'carriers', 'apicarrier.all.json');
const PUBLIC_DIR = process.cwd();

let CARRIERS = [];
try {
    if (fs.existsSync(CARRIER_FILE)) {
        const raw = fs.readFileSync(CARRIER_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            CARRIERS = parsed;
        } else if (Array.isArray(parsed?.data)) {
            CARRIERS = parsed.data;
        }
    }
} catch (err) {
    console.warn('Could not load carriers file:', err.message);
}

function resolveCarrierCode(carrierCode, carrierText) {
    if (carrierCode) return Number(carrierCode);
    if (!carrierText) return undefined;
    const numeric = String(carrierText).trim().match(/^(\d+)/);
    if (numeric) return Number(numeric[1]);
    const target = String(carrierText).trim().toLowerCase();
    const found = CARRIERS.find(c => String(c._name || '').toLowerCase() === target);
    if (found) return Number(found.key);
    const partial = CARRIERS.find(c => String(c._name || '').toLowerCase().includes(target));
    return partial ? Number(partial.key) : undefined;
}

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText;
        const err = new Error(msg);
        err.status = res.status;
        err.body = data;
        throw err;
    }
    return data;
}

async function handleTrack(number, carrier, carrierText) {
    if (!API_KEY) {
        throw new Error('Missing TRACK17_KEY environment variable');
    }

    const carrierResolved = resolveCarrierCode(carrier, carrierText);

    // Step 1: register the tracking number (ensures it exists before querying)
    const registerBody = [
        {
            number,
            carrier: carrierResolved || undefined
        }
    ];

    const register = await fetchJson(`${BASE_V24}/register`, {
        method: 'POST',
        headers: {
            '17token': API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerBody)
    });

    if (Array.isArray(register?.data?.errors) && register.data.errors.length) {
        const firstErr = register.data.errors[0];
        const msg = firstErr?.message || 'Register failed';
        const err = new Error(msg);
        err.body = register.data.errors;
        throw err;
    }

    // Step 2: get tracking info (v2.4)
    const info = await fetchJson(`${BASE_V24}/gettrackinfo`, {
        method: 'POST',
        headers: {
            '17token': API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify([
            {
                number,
                carrier: carrierResolved || undefined
            }
        ])
    });

    return { register, info };
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*'
    });
    res.end(body);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

function serveStatic(req, res, url) {
    let filePath = path.join(PUBLIC_DIR, decodeURIComponent(url.pathname));
    if (url.pathname === '/') {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    // Prevent path traversal
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(PUBLIC_DIR)) {
        return sendJson(res, 403, { error: 'Forbidden' });
    }
    fs.stat(resolved, (err, stats) => {
        if (err || !stats.isFile()) {
            return sendJson(res, 404, { error: 'Not found' });
        }
        const stream = fs.createReadStream(resolved);
        res.writeHead(200, {
            'Content-Type': guessContentType(resolved),
            'Content-Length': stats.size
        });
        stream.pipe(res);
    });
}

function guessContentType(file) {
    const ext = path.extname(file).toLowerCase();
    switch (ext) {
        case '.html': return 'text/html; charset=utf-8';
        case '.js': return 'application/javascript; charset=utf-8';
        case '.css': return 'text/css; charset=utf-8';
        case '.json': return 'application/json; charset=utf-8';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.svg': return 'image/svg+xml';
        case '.ico': return 'image/x-icon';
        default: return 'application/octet-stream';
    }
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'POST' && url.pathname === '/api/track') {
        try {
            const body = await parseBody(req);
            const number = (body.number || '').trim();
            const carrier = body.carrier;
            const carrierText = (body.carrierText || '').trim();
            if (!number) {
                return sendJson(res, 400, { error: 'number is required' });
            }
            // Handle CORS preflight
            if (req.headers.origin) {
                res.setHeader('Access-Control-Allow-Origin', '*');
            }
            const result = await handleTrack(number, carrier, carrierText);
            return sendJson(res, 200, result);
        } catch (err) {
            const status = err.status || 500;
            return sendJson(res, status, { error: err.message || 'Unknown error', detail: err.body });
        }
    }

    if (req.method === 'GET' && url.pathname === '/api/carriers') {
        try {
            if (!fs.existsSync(CARRIER_FILE)) {
                return sendJson(res, 500, { error: 'Carrier list file not found' });
            }
            const raw = fs.readFileSync(CARRIER_FILE, 'utf8');
            const data = JSON.parse(raw);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            return res.end(JSON.stringify(data));
        } catch (err) {
            return sendJson(res, 500, { error: err.message || 'Failed to load carriers' });
        }
    }

    if (req.method === 'OPTIONS') {
        // CORS preflight
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    if (req.method === 'GET') {
        return serveStatic(req, res, url);
    }

    // Fallback 404
    sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
