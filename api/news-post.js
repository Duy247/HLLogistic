import { isAdmin } from '../server-lib/admin-auth.js';
import { safePost } from '../server-lib/news-content.js';
import { allowCors, rateLimit } from '../server-lib/security.js';
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'nodejs'
};


export default async function handler(req, res) {
  if (!allowCors(req, res, 'GET,OPTIONS')) return;

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (req.headers?.['x-admin-secret'] && !rateLimit(req, res, 'news-read-auth', 60)) return;
  const staff = await isAdmin(req, req.headers?.['x-admin-secret'], process.env.NEWS_ADMIN_SECRET);
  const idParam = req.query.id;
  const slugParam = req.query.slug;

  if (!idParam && !slugParam) {
    res.status(400).json({ error: 'id or slug is required' });
    return;
  }

  try {
    let rows = [];
    if (idParam) {
      const id = Number.parseInt(idParam, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'id must be a number' });
        return;
      }
      ({ rows } = await sql`
        select id,
               title,
               summary,
               cover_url as "coverUrl",
               slug,
               content_html as "contentHtml",
               published_at as "publishedAt",
               created_at as "createdAt"
        from news
        where id = ${id} and (${staff} or (published_at is not null and published_at <= now()))
        limit 1
      `);
    } else {
      ({ rows } = await sql`
        select id,
               title,
               summary,
               cover_url as "coverUrl",
               slug,
               content_html as "contentHtml",
               published_at as "publishedAt",
               created_at as "createdAt"
        from news
        where slug = ${slugParam} and (${staff} or (published_at is not null and published_at <= now()))
        limit 1
      `);
    }

    if (!rows.length) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.status(200).json({ post: safePost(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
}
