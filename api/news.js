import { sanitizeContent, plainText, safePost } from '../server-lib/news-content.js';
import { allowCors, verifySecret, rateLimit } from '../server-lib/security.js';
import { readBody } from '../server-lib/body.js';
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'nodejs'
};

const SECRET = process.env.NEWS_ADMIN_SECRET || '';


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

export default async function handler(req, res) {
  if (!allowCors(req, res, 'GET,POST,PUT,DELETE,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    if (req.headers?.['x-admin-secret'] && !rateLimit(req, res, 'news-read-auth', 60)) return;
    const staff = verifySecret(req.headers?.['x-admin-secret'], SECRET);
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
        where (${staff} or (published_at is not null and published_at <= now()))
        order by published_at desc, created_at desc
        limit ${pageSize} offset ${offset}
      `;

      const hasMore = rows.length > limit;
      const posts = (hasMore ? rows.slice(0, limit) : rows).map(safePost);
      const nextOffset = offset + posts.length;

      res.status(200).json({ posts, hasMore, nextOffset });
    } catch (err) {
      res.status(500).json({ error: 'Request failed' });
    }
    return;
  }

  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!SECRET) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  if (!rateLimit(req, res, 'news-requests', 180)) return;
  try {
    const body = await readBody(req);
    const providedSecret = body.secret || body.secretKey || body.key;
    if (!verifySecret(providedSecret, SECRET)) {
      if (!rateLimit(req, res, 'news-auth', 10)) return;
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (body.action === 'preview') { res.status(200).json({ contentHtml: sanitizeContent(body.contentHtml) }); return; }
    if (body.action === 'verify') { res.status(200).json({ authenticated: true }); return; }
    if (req.method === 'DELETE') {
      const id = Number.parseInt(body.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'id is required' });
        return;
      }
      const { rows } = await sql`
        delete from news
        where id = ${id}
        returning id
      `;
      if (!rows.length) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      res.status(200).json({ removed: rows[0] });
      return;
    }

    const title = plainText(body.title).trim();
    const summary = String(body.summary || '').trim();
    const coverUrl = String(body.coverUrl || '').trim();
    const contentHtml = sanitizeContent(body.contentHtml).trim();
    const publishedAt = body.publishedAt || null;
    const slug = String(body.slug || '').trim() || slugify(title);

    if (req.method === 'PUT') {
      const id = Number.parseInt(body.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'id is required' });
        return;
      }
      if (!title || !contentHtml) {
        res.status(400).json({ error: 'title and contentHtml are required' });
        return;
      }
      const { rows } = await sql`
        update news
        set title = ${title},
            summary = ${summary || null},
            cover_url = ${coverUrl || null},
            content_html = ${contentHtml},
            slug = ${slug || null},
            published_at = ${publishedAt},
            updated_at = now()
        where id = ${id}
        returning id,
                  title,
                  summary,
                  cover_url as "coverUrl",
                  slug,
                  published_at as "publishedAt",
                  updated_at as "updatedAt"
      `;
      if (!rows.length) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      res.status(200).json({ post: safePost(rows[0]) });
      return;
    }

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

    res.status(200).json({ post: safePost(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
