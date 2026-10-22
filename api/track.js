import { databaseRateLimit } from '../server-lib/db-rate-limit.js';
import { allowCors } from '../server-lib/security.js';
import { readBody } from '../server-lib/body.js';
const BASE_V24 = 'https://api.17track.net/track/v2.4';
import fs from 'fs';
import path from 'path';

let carriers = [];
let carrierNameByKey = {};
const CARRIER_FILE = path.join(process.cwd(), 'carriers', 'apicarrier.all.json');

function loadCarriers() {
  try {
    if (fs.existsSync(CARRIER_FILE)) {
      const raw = fs.readFileSync(CARRIER_FILE, 'utf8');
      const data = JSON.parse(raw);
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      carriers = list;
      carrierNameByKey = list.reduce((acc, c) => {
        acc[c.key] = c._name || c.name || '';
        return acc;
      }, {});
    }
  } catch (err) {
    console.warn('Failed to load carriers', err.message);
  }
}
loadCarriers();

function resolveCarrierCode(carrierCode, carrierText) {
  if (carrierCode) return Number(carrierCode);
  if (!carrierText) return undefined;
  const numeric = String(carrierText).trim().match(/^(\d+)/);
  if (numeric) return Number(numeric[1]);
  const target = String(carrierText).trim().toLowerCase();
  const found = carriers.find(c => String(c._name || c.name || '').toLowerCase() === target);
  if (found) return Number(found.key);
  const partial = carriers.find(c => String(c._name || c.name || '').toLowerCase().includes(target));
  return partial ? Number(partial.key) : undefined;
}

export default async function handler(req, res) {
  if (!allowCors(req, res, 'POST,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!await databaseRateLimit(req, res)) return;

  const API_KEY = process.env.TRACK17_KEY || '';
  if (!API_KEY) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  try {
    const body = await readBody(req, 4096);
    const number = typeof body.number === 'string' ? body.number.trim() : '';
    const carrierCode = body.carrier;
    const carrierText = typeof body.carrierText === 'string' ? body.carrierText.trim() : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/.test(number) ||
        (body.carrier !== undefined && ((!['string', 'number'].includes(typeof body.carrier)) || !/^[0-9]{1,8}$/.test(String(body.carrier)) || Number(body.carrier) < 1)) ||
        (body.carrierText !== undefined && (typeof body.carrierText !== 'string' || body.carrierText.length > 100))) {
      res.status(400).json({ error: 'Invalid tracking input' });
      return;
    }

    const carrierResolved = resolveCarrierCode(carrierCode, carrierText);

    // Step 1: register
    const registerRes = await fetch(`${BASE_V24}/register`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
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
    const register = await registerRes.json().catch(() => ({}));
    // Duplicate registration is safe to read; never delete an existing subscription.
    // Provider code documented at https://api.17track.net/en/doc
    const registrationErrors = [
      ...(register?.data?.errors || []),
      ...(register?.data?.rejected || []).map(item => item.error || {})
    ];
    if (!registerRes.ok || (register.code !== undefined && register.code !== 0) ||
        registrationErrors.some(error => error.code !== -18019901)) {
      res.status(502).json({ error: 'Tracking service unavailable' });
      return;
    }

    // Step 2: get track info
    const infoRes = await fetch(`${BASE_V24}/gettrackinfo`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
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
    const info = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok || (info.code !== undefined && info.code !== 0) || info?.data?.errors?.length || info?.data?.rejected?.length) {
      res.status(502).json({ error: 'Tracking service unavailable' });
      return;
    }

    // A public lookup must not delete an existing provider registration.
    res.status(200).json({ register: { data: { accepted: [] } }, info: { data: { accepted: info?.data?.accepted || [] } }, stop: null });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
