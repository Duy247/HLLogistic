import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'nodejs'
};

const SECRET = process.env.NEWS_SECRET || '';

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseNumber(value, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num < 0) return fallback;
  return num;
}

function slugify(text) {
  if (!text) return null;
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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
  allowCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const limit = Math.min(parseNumber(req.query.limit, 5), 20);
    const offset = parseNumber(req.query.offset, 0);
    const pageSize = limit + 1;

    try {
      const { rows } = await sql`
        select id,
               title,
               summary,
               cover_url as "coverUrl",
               slug,
               published_at as "publishedAt"
        from news
        order by published_at desc, created_at desc
        limit ${pageSize} offset ${offset}
      `;

      const hasMore = rows.length > limit;
      const posts = hasMore ? rows.slice(0, limit) : rows;
      const nextOffset = offset + posts.length;

      res.status(200).json({ posts, hasMore, nextOffset });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch news' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!SECRET) {
    res.status(500).json({ error: 'NEWS_SECRET not set' });
    return;
  }

  try {
    const body = await readBody(req);
    const providedSecret = body.secret || body.secretKey || body.key;
    if (providedSecret !== SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const title = String(body.title || '').trim();
    const summary = String(body.summary || '').trim();
    const coverUrl = String(body.coverUrl || '').trim();
    const contentHtml = String(body.contentHtml || '').trim();
    const publishedAt = body.publishedAt || null;
    const slug = String(body.slug || '').trim() || slugify(title);

    if (!title || !contentHtml) {
      res.status(400).json({ error: 'title and contentHtml are required' });
      return;
    }

    const { rows } = await sql`
      insert into news (title, summary, cover_url, content_html, slug, published_at)
      values (${title}, ${summary || null}, ${coverUrl || null}, ${contentHtml}, ${slug || null}, ${publishedAt})
      returning id,
                title,
                summary,
                cover_url as "coverUrl",
                slug,
                published_at as "publishedAt",
                created_at as "createdAt"
    `;

    res.status(200).json({ post: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create post' });
  }
}
