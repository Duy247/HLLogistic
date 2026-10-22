import { sql } from '@vercel/postgres';
import { hashPassword } from '../server-lib/admin-auth.js';
const username = process.argv[2]?.trim().toLowerCase();
if (process.argv.length !== 3 || !/^[a-z0-9_.@-]{1,100}$/.test(username || '')) {
  console.error('Usage: node scripts/create-admin.js USERNAME < password-file (password via stdin only)');
  process.exit(1);
}
try {
  let password = '';
  for await (const chunk of process.stdin) {
    password += chunk.toString();
    if (password.length > 1026) throw new Error();
  }
  password = password.replace(/\r?\n$/, '');
  if (password.length < 12 || password.length > 1024) throw new Error();
  const hash = await hashPassword(password);
  password = '';
  await sql`insert into admin_users (username, password_hash) values (${username}, ${hash})`;
  console.log('Admin user created.');
} catch { console.error('Unable to create admin user. Check configuration, unique username and password length (12–1024).'); process.exitCode = 1; }
finally { await sql.end(); }
