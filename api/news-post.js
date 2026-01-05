import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'nodejs'
};

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  allowCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
        where id = ${id}
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
        where slug = ${slugParam}
        limit 1
      `);
    }

    if (!rows.length) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.status(200).json({ post: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch post' });
  }
}
