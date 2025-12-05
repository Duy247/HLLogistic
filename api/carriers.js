import fs from 'fs';
import path from 'path';

const CARRIER_FILE = path.join(process.cwd(), 'carriers', 'apicarrier.all.json');

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
      res.status(500).json({ error: 'Carrier list file not found' });
      return;
    }
    const raw = fs.readFileSync(CARRIER_FILE, 'utf8');
    const data = JSON.parse(raw);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load carriers' });
  }
}
