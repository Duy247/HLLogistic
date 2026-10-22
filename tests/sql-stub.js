import assert from 'node:assert/strict';
const rateBuckets = new Map();
export async function sql(strings, ...values) {
  if (process.env.LEGACY_ADMIN_SECRET_ENABLED === 'true' && strings.join('').includes('consume_rate_limit') && !globalThis.sqlQueue?.[0]?.match?.includes('consume_rate_limit')) {
    const [scope, ip, , limit] = values;
    const key = scope + ip;
    const count = (rateBuckets.get(key) || 0) + 1;
    rateBuckets.set(key, count);
    return {rows:[{allowed: count <= limit, retry_after: 60}]};
  }
  const expected = globalThis.sqlQueue?.shift();
  assert.ok(expected, 'Unexpected SQL call');
  const query = strings.join('?').replace(/\s+/g, ' ').trim();
  assert.match(query, new RegExp(expected.match, 'i'));
  if (expected.values) assert.deepEqual(values, expected.values);
  if (expected.error) throw new Error(expected.error);
  return { rows: expected.rows || [] };
}
