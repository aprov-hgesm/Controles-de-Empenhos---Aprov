// Retry only the known intermittent Next.js Google Fonts extensionless URL bug.
// Does not hide real errors, change dependency versions, replace fonts or deploy.
import { spawnSync } from 'node:child_process';

const MAX_ATTEMPTS = 3;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });
  const output = String(result.stdout || '') + '\n' + String(result.stderr || '');
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status === 0 && !result.error) process.exit(0);

  const fontBug = /An error occurred in [`']next\/font[`']/.test(output)
    && /Cannot read properties of null \(reading [`']1[`']\)/.test(output)
    && /google\/loader\.js/.test(output);
  if (!fontBug || attempt === MAX_ATTEMPTS || result.error) {
    if (result.error) console.error(result.error.message);
    process.exit(result.status || 1);
  }
  console.warn('[EMPROVEX CI] Retrying identical build after transient next/font Google URL error. '
    + `Attempt ${attempt + 1}/${MAX_ATTEMPTS}.`);
}
