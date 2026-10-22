// Vercel may supply an object/string/Buffer; local Node supplies a stream.
export async function readBody(req) {
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') return body ? JSON.parse(body) : {};
  return body && typeof body === 'object' ? body : {};
}
