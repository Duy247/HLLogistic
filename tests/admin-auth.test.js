import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, checkPassword, sessionCookie, sessionUser, isAdmin } from '../server-lib/admin-auth.js';
import { databaseRateLimit } from '../server-lib/db-rate-limit.js';
import auth from '../api/admin-auth.js';
import news from '../api/news.js';
import parcel from '../api/parcel-updates.js';
process.env.ADMIN_SESSION_SECRET = 'synthetic-session-key-for-testing-only-123456';
function response() { return { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; }, end() {} }; }
const user = { id: '7', username: 'staff', session_version: 1 };
const req = cookie => ({method:'POST', headers: cookie ? {cookie} : {}, socket:{remoteAddress:'test'}, body:{action:'verify'}});
function userQuery() { return {match:'from admin_users', values:['7',1], rows:[user]}; }
test('scrypt salts passwords and rejects wrong or missing hashes', async () => {
 const hash = await hashPassword('synthetic-password');
 assert.notEqual(hash, await hashPassword('synthetic-password'));
 assert.equal(await checkPassword('synthetic-password', hash), true);
 assert.equal(await checkPassword('wrong', hash), false);
 assert.equal(await checkPassword('wrong', undefined), false);
});
test('signed sessions expire, reject tampering and disabled users; legacy defaults off', async () => {
 delete process.env.LEGACY_ADMIN_SECRET_ENABLED;
 assert.equal(await isAdmin(req(), 'old', 'old'), false);
 process.env.LEGACY_ADMIN_SECRET_ENABLED = 'true';
 assert.equal(await isAdmin(req(), 'old', 'old'), true);
 delete process.env.LEGACY_ADMIN_SECRET_ENABLED;
 const cookie = sessionCookie(user).split(';')[0];
 globalThis.sqlQueue = [userQuery()];
 assert.equal((await sessionUser(req(cookie))).id, '7');
 assert.equal(await sessionUser(req(cookie + 'x')), null);
 assert.equal(await sessionUser(req(sessionCookie(user, 0).split(';')[0])), null);
 globalThis.sqlQueue = [{match:'from admin_users', rows:[]}];
 assert.equal(await sessionUser(req(cookie)), null);
 for (const handler of [news, parcel]) {
   globalThis.sqlQueue = [userQuery()];
   const res = response(); await handler(req(cookie),res);
   assert.equal(res.statusCode,200);
 }
});
test('login issues secure cookie, failure is generic, logout revokes sessions', async () => {
 const hash = await hashPassword('synthetic-password');
 const login = req(); login.body = {username:'STAFF',password:'synthetic-password'};
 globalThis.sqlQueue = [{match:'consume_rate_limit', rows:[{allowed:true}]},{match:'from admin_users',values:['staff'],rows:[{...user,password_hash:hash}]}];
 const res = response(); await auth(login,res);
 assert.equal(res.statusCode,200);
 assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict; Max-Age=/);
 const logout = req(res.headers['Set-Cookie'].split(';')[0]); logout.body={action:'logout'};
 globalThis.sqlQueue = [userQuery(),{match:'update admin_users set session_version',values:['7']}];
 const out = response(); await auth(logout,out);
 assert.equal(out.statusCode,200); assert.match(out.headers['Set-Cookie'],/Max-Age=0/);
 globalThis.sqlQueue = [{match:'consume_rate_limit',rows:[{allowed:true}]},{match:'from admin_users',rows:[]}];
 const bad = response(); await auth(login,bad); assert.equal(bad.statusCode,401);
 assert.deepEqual(bad.body,{error:'Invalid credentials'});
});
test('database limiter uses shared scope/IP budgets, Retry-After and fails closed', async () => {
 process.env.TRACK_RATE_IP_LIMIT='3'; process.env.TRACK_RATE_GLOBAL_LIMIT='12'; process.env.TRACK_RATE_WINDOW_SECONDS='90';
 globalThis.sqlQueue=[{match:'consume_rate_limit',rows:[{allowed:true}]}];
 assert.equal(await databaseRateLimit(req(), response()),true);
 globalThis.sqlQueue=[{match:'consume_rate_limit',rows:[{allowed:false,retry_after:42}]}];
 const denied=response(); assert.equal(await databaseRateLimit(req(),denied),false);
 assert.equal(denied.statusCode,429); assert.equal(denied.headers['Retry-After'],'42');
 globalThis.sqlQueue=[{match:'consume_rate_limit',error:'synthetic database failure'}];
 const failed=response(); await databaseRateLimit(req(),failed); assert.equal(failed.statusCode,503);
 for (const key of ['TRACK_RATE_IP_LIMIT','TRACK_RATE_GLOBAL_LIMIT','TRACK_RATE_WINDOW_SECONDS']) delete process.env[key];
});
