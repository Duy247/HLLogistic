import assert from 'node:assert/strict';
export async function sql(strings, ...values) {
  const expected = globalThis.sqlQueue?.shift();
  assert.ok(expected, 'Unexpected SQL call');
  const query = strings.join('?').replace(/\s+/g, ' ').trim();
  assert.match(query, new RegExp(expected.match, 'i'));
  if (expected.values) assert.deepEqual(values, expected.values);
  if (expected.error) throw new Error(expected.error);
  return { rows: expected.rows || [] };
}
