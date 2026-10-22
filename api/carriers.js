import { allowCors } from '../server-lib/security.js';
import fs from 'fs';
import path from 'path';

const CARRIER_FILE = path.join(process.cwd(), 'carriers', 'apicarrier.all.json');

export default function handler(req, res) {
  if (!allowCors(req, res, 'GET,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!fs.existsSync(CARRIER_FILE)) {
      res.status(500).json({ error: 'Service unavailable' });
      return;
    }
    const raw = fs.readFileSync(CARRIER_FILE, 'utf8');
    const data = JSON.parse(raw);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
