import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, checkPassword, sessionCookie, sessionUser, isAdmin } from '../server-lib/admin-auth.js';
import { databaseRateLimit } from '../server-lib/db-rate-limit.js';
import auth from '../api/admin-auth.js';
import news from '../api/news.js';
import parcel from '../api/parcel-updates.js';
process.env.ADMIN_SESSION_SECRET = 'ab'.repeat(32);
function response() { return { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; }, end() {} }; }
const user = { id: '7', username: 'staff', session_version: 1 };
const req = cookie => ({method:'POST', headers: {origin:'https://www.hltrungviet.com', ...(cookie ? {cookie} : {})}, socket:{remoteAddress:'test'}, body:{action:'verify'}});
function userQuery() { return {match:'from admin_users', values:['7',1], rows:[user]}; }
test('scrypt salts passwords and rejects wrong or missing hashes', async () => {
 const hash = await hashPassword('synthetic-password');
 assert.match(hash, /^scrypt\$32768\$8\$1\$/);
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
 globalThis.sqlQueue = [{match:'consume_rate_limit', rows:[{allowed:true}]},{match:'consume_rate_limit', rows:[{allowed:true}]},{match:'from admin_users',values:['staff'],rows:[{...user,password_hash:hash}]},{match:'update admin_users set session_version',values:['7'],rows:[{...user,session_version:2}]}];
 const res = response(); await auth(login,res);
 assert.equal(res.statusCode,200);
 assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict; Max-Age=/);
 const logout = req(res.headers['Set-Cookie'].split(';')[0]); logout.body={action:'logout'};
 globalThis.sqlQueue = [{match:'from admin_users',values:['7',2],rows:[{...user,session_version:2}]},{match:'update admin_users set session_version',values:['7']}];
 const out = response(); await auth(logout,out);
 assert.equal(out.statusCode,200); assert.match(out.headers['Set-Cookie'],/Max-Age=0/);
 globalThis.sqlQueue = [{match:'consume_rate_limit',rows:[{allowed:true}]},{match:'consume_rate_limit',rows:[{allowed:true}]},{match:'from admin_users',rows:[]}];
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

test('parameterized and original scrypt hashes verify; unsafe parameters use dummy rejection', async () => {
 const { scryptSync } = await import('node:crypto');
 const salt = '12'.repeat(16);
 const legacy = scryptSync('test-password', salt, 64, {N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 assert.equal(await checkPassword('test-password', `scrypt:${salt}:${legacy}`), true);
 assert.equal(await checkPassword('wrong', `scrypt:${salt}:${legacy}`), false);
 const strong = scryptSync('test-password', salt, 64, {N:65536,r:8,p:1,maxmem:128*1024*1024}).toString('hex');
 assert.equal(await checkPassword('test-password', `scrypt$65536$8$1$${salt}$${strong}`), true);
 for (const params of ['1$8$1', '32768$99$1', '32768$8$99', '999999999$8$1']) {
   assert.equal(await checkPassword('test-password', `scrypt$${params}$${salt}$${strong}`), false);
 }
});

test('all mutating methods require an exact Origin, while originless reads/preflights work', async () => {
 const { allowCors } = await import('../server-lib/security.js');
 for (const method of ['POST','PUT','PATCH','DELETE']) {
   for (const origin of [undefined, 'null', 'https://evil.invalid', 'https://www.hltrungviet.com.evil.invalid']) {
     const res = response();
     assert.equal(allowCors({method, headers:origin ? {origin} : {}}, res, method), false);
     assert.equal(res.statusCode,403);
   }
   assert.equal(allowCors({method,headers:{origin:'https://www.hltrungviet.com'}},response(),method),true);
 }
 for (const method of ['GET','OPTIONS']) assert.equal(allowCors({method,headers:{}}, response(),method),true);
 const denied = response(); await auth({...req(),headers:{}}, denied); assert.equal(denied.statusCode,403);
});

test('session signing rejects absent, short, nonhex and oversized keys', () => {
 const original = process.env.ADMIN_SESSION_SECRET;
 try {
   for (const key of ['', 'a'.repeat(32), 'g'.repeat(64), 'a'.repeat(65)]) {
     process.env.ADMIN_SESSION_SECRET=key;
     assert.throws(() => sessionCookie(user), /configuration unavailable/);
   }
   delete process.env.ADMIN_SESSION_SECRET;
   assert.throws(() => sessionCookie(user), /configuration unavailable/);
 } finally { process.env.ADMIN_SESSION_SECRET=original; }
});

test('login limits have independent config and username bucket is shared across IPs', async () => {
 const { createHash } = await import('node:crypto');
 const hash = text => createHash('sha256').update(text).digest('hex');
 process.env.TRACK_RATE_WINDOW_SECONDS='42';
 process.env.ADMIN_LOGIN_RATE_WINDOW_SECONDS='120';
 process.env.ADMIN_LOGIN_RATE_IP_LIMIT='7';
 process.env.ADMIN_LOGIN_RATE_GLOBAL_LIMIT='50';
 process.env.ADMIN_LOGIN_RATE_USERNAME_LIMIT='3';
 try {
   globalThis.sqlQueue=[{match:'consume_rate_limit',values:['admin-login',hash('test'),120,7,50],rows:[{allowed:true}]}];
   assert.equal(await databaseRateLimit(req(),response(),'admin-login'),true);
   for (const ip of ['first-ip','second-ip']) {
     globalThis.sqlQueue=[{match:'consume_rate_limit',values:['admin-login-username',hash('staff'),120,3,50],rows:[{allowed:false,retry_after:77}]}];
     const denied=response(); const request=req(); request.socket.remoteAddress=ip;
     assert.equal(await databaseRateLimit(request,denied,'admin-login-username','staff'),false);
     assert.equal(denied.statusCode,429); assert.equal(denied.headers['Retry-After'],'77');
   }
   const login=req(); login.body={username:' STAFF ',password:'wrong'};
   globalThis.sqlQueue=[{match:'consume_rate_limit',rows:[{allowed:true}]},{match:'consume_rate_limit',values:['admin-login-username',hash('staff'),120,3,50],rows:[{allowed:false,retry_after:77}]}];
   const denied=response(); await auth(login,denied); assert.equal(denied.statusCode,429);
   assert.equal(globalThis.sqlQueue.length,0);
 } finally {
   for (const key of ['TRACK_RATE_WINDOW_SECONDS','ADMIN_LOGIN_RATE_WINDOW_SECONDS','ADMIN_LOGIN_RATE_IP_LIMIT','ADMIN_LOGIN_RATE_GLOBAL_LIMIT','ADMIN_LOGIN_RATE_USERNAME_LIMIT']) delete process.env[key];
 }
});

test('every successful login advances the version and invalidates earlier cookies', async () => {
 const hash = await hashPassword('synthetic-password');
 const login=req(); login.body={username:'staff',password:'synthetic-password'};
 let oldCookie=sessionCookie(user).split(';')[0];
 for (const version of [2,3]) {
   globalThis.sqlQueue=[
     {match:'consume_rate_limit',rows:[{allowed:true}]},
     {match:'consume_rate_limit',rows:[{allowed:true}]},
     {match:'from admin_users',rows:[{...user,password_hash:hash,session_version:version-1}]},
     {match:'update admin_users set session_version = session_version \\+ 1',values:['7'],rows:[{...user,session_version:version}]}
   ];
   const res=response(); await auth(login,res); assert.equal(res.statusCode,200);
   const cookie=res.headers['Set-Cookie'].split(';')[0];
   const payload = JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url').toString());
   assert.equal(payload.version,version);
   globalThis.sqlQueue=[{match:'from admin_users',values:['7',version-1],rows:[]}];
   assert.equal(await sessionUser(req(oldCookie)),null);
   globalThis.sqlQueue=[{match:'from admin_users',values:['7',version],rows:[{...user,session_version:version}]}];
   assert.equal((await sessionUser(req(cookie))).session_version,version);
   oldCookie=cookie;
 }
});
