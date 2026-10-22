import { allowCors, verifySecret, rateLimit } from '../server-lib/security.js';
import { readBody } from '../server-lib/body.js';
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'nodejs'
};

const SECRET = process.env.PARCEL_UPDATES_SECRET || '';

function normalizeCode(code) {
  return String(code || '').trim();
}

function defaultMidnightIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function normalizeInput(update = {}) {
  return {
    time: update.time || update.timestamp || update.date || defaultMidnightIso(),
    event: update.event || update.description || '',
    location: update.location || update.place || ''
  };
}

async function ensureParcel(code) {
  await sql`insert into parcels (code) values (${code}) on conflict (code) do nothing`;
}

async function fetchUpdates(code) {
  const { rows } = await sql`
    select id, code, time, event, location, created_at as "createdAt", updated_at as "updatedAt"
    from parcel_updates
    where code = ${code}
    order by time desc, created_at desc
  `;
  return rows;
}

async function latestUpdateId(code) {
  const { rows } = await sql`
    select id
    from parcel_updates
    where code = ${code}
    order by time desc, created_at desc
    limit 1
  `;
  return rows[0]?.id;
}

async function createUpdate(code, data) {
  const input = normalizeInput(data);
  await ensureParcel(code);
  const { rows } = await sql`
    insert into parcel_updates (code, time, event, location)
    values (${code}, ${input.time}, ${input.event}, ${input.location})
    returning id, code, time, event, location, created_at as "createdAt", updated_at as "updatedAt"
  `;
  return rows[0];
}

async function updateUpdate(code, updateId, data) {
  const input = normalizeInput(data);
  const targetId = updateId || (await latestUpdateId(code));
  if (!targetId) return null;
  const { rows } = await sql`
    update parcel_updates
    set time = coalesce(${input.time}, time),
        event = coalesce(${input.event}, event),
        location = coalesce(${input.location}, location),
        updated_at = now()
    where id = ${targetId} and code = ${code}
    returning id, code, time, event, location, created_at as "createdAt", updated_at as "updatedAt"
  `;
  return rows[0] || null;
}

async function deleteUpdate(code, updateId) {
  const targetId = updateId || (await latestUpdateId(code));
  if (!targetId) return null;
  const { rows } = await sql`
    delete from parcel_updates
    where id = ${targetId} and code = ${code}
    returning id, code, time, event, location, created_at as "createdAt", updated_at as "updatedAt"
  `;
  return rows[0] || null;
}

function send(res, status, payload) {
  res.status(status).json(payload);
}


export default async function handler(req, res) {
  if (!allowCors(req, res, 'GET,POST,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const code = normalizeCode(req.query.code || req.query.parcel || req.query.number);
    if (!code) {
      send(res, 400, { error: 'code is required' });
      return;
    }
    try {
      const updates = await fetchUpdates(code);
      send(res, 200, { code, updates });
    } catch (err) {
      send(res, 500, { error: 'Request failed' });
    }
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!SECRET) {
    send(res, 500, { error: 'Service unavailable' });
    return;
  }

  if (!rateLimit(req, res, 'parcel-updates-requests', 180)) return;
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    send(res, 500, { error: 'Request failed' });
    return;
  }
  const providedSecret = body.secret || body.secretKey || body.key;
  if (!verifySecret(providedSecret, SECRET)) {
    if (!rateLimit(req, res, 'parcel-updates-auth', 10)) return;
    send(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (body.action === 'verify') { res.status(200).json({ authenticated: true }); return; }

  const mode = String(body.mode || '').trim().toUpperCase();
  const code = normalizeCode(body.parcelCode || body.code || body.number);
  const data = body.data || {};
  const updateId = body.updateId || data.id || data.updateId;

  if (!mode) {
    send(res, 400, { error: 'mode is required' });
    return;
  }

  if (!code) {
    send(res, 400, { error: 'parcelCode is required' });
    return;
  }

  try {
    if (mode === 'CREATE') {
      const created = await createUpdate(code, data);
      send(res, 200, { code, update: created });
      return;
    }

    if (mode === 'UPDATE') {
      const updated = await updateUpdate(code, updateId, data);
      if (!updated) {
        send(res, 404, { error: 'Update not found' });
        return;
      }
      send(res, 200, { code, update: updated });
      return;
    }

    if (mode === 'DELETE') {
      const removed = await deleteUpdate(code, updateId);
      if (!removed) {
        send(res, 404, { error: 'Update not found' });
        return;
      }
      send(res, 200, { code, removed });
      return;
    }
  } catch (err) {
    send(res, 500, { error: 'Request failed' });
    return;
  }

  send(res, 400, { error: 'Unknown mode. Use CREATE, UPDATE or DELETE.' });
}
