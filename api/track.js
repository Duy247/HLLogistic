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

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const API_KEY = process.env.TRACK17_KEY || '';
  if (!API_KEY) {
    res.status(500).json({ error: 'TRACK17_KEY not set' });
    return;
  }

  try {
    const body = await readBody(req);
    const number = (body.number || '').trim();
    const carrierCode = body.carrier;
    const carrierText = (body.carrierText || '').trim();
    if (!number) {
      res.status(400).json({ error: 'number is required' });
      return;
    }

    const carrierResolved = resolveCarrierCode(carrierCode, carrierText);

    // Step 1: register
    const registerRes = await fetch(`${BASE_V24}/register`, {
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
    const register = await registerRes.json().catch(() => ({}));
    if (!registerRes.ok || (register?.data?.errors && register.data.errors.length)) {
      const errMsg = register?.data?.errors?.[0]?.message || registerRes.statusText;
      res.status(registerRes.status || 500).json({ error: errMsg, detail: register });
      return;
    }

    // Step 2: get track info
    const infoRes = await fetch(`${BASE_V24}/gettrackinfo`, {
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
    const info = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok) {
      res.status(infoRes.status || 500).json({ error: infoRes.statusText, detail: info });
      return;
    }

    // Step 3: delete tracking to avoid further polling
    const stopRes = await fetch(`${BASE_V24}/deletetrack`, {
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
    const stop = await stopRes.json().catch(() => ({}));

    res.status(200).json({ register, info, stop });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
