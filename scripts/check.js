import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = ['server.js', ...['api', 'server-lib', 'public/js', 'scripts', 'tests'].flatMap(dir =>
  readdirSync(dir).filter(name => name.endsWith('.js')).map(name => `${dir}/${name}`))];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const result = spawnSync(process.execPath,
  ['--import', './tests/register.js', '--test', ...readdirSync('tests').filter(name => name.endsWith('.test.js')).map(name => `tests/${name}`)],
  { stdio: 'inherit' });
process.exit(result.status || (result.signal ? 1 : 0));
