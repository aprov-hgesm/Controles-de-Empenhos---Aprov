/**
 * Inspect Next standalone/static output before building a Cloud Run QA image.
 * Detects legacy production Firebase identifiers without ever printing them.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baseline = JSON.parse(readFileSync(join(root, 'firebase-applet-config.json'), 'utf8'));
const expectedQA = 'emprovex-qa-r1-261015-6275';
const roots = [join(root, '.next', 'standalone'), join(root, '.next', 'static')];
const scanExt = /\.(?:js|cjs|mjs|json|html|css|txt|map)$/i;
const forbiddenValues = [baseline.projectId, baseline.firestoreDatabaseId,
  baseline.appId, baseline.apiKey].filter(x => typeof x === 'string' && x.length > 0);
let inspected = 0;
const violations = [];
for (const start of roots) {
  if (!existsSync(start)) throw new Error('QA_ARTIFACT_MISSING: ' + relative(root, start));
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!entry.isFile() || !scanExt.test(entry.name)) continue;
      if (statSync(path).size > 30 * 1024 * 1024) {
        violations.push(relative(root, path) + ': unscanned large file');
        continue;
      }
      inspected++;
      const contents = readFileSync(path, 'utf8');
      if (forbiddenValues.some(value => contents.includes(value))) {
        violations.push(relative(root, path));
      }
    }
  };
  walk(start);
}
if (process.env.EMPROVEX_CLOUD_PROJECT_ID &&
    process.env.EMPROVEX_CLOUD_PROJECT_ID !== expectedQA) {
  throw new Error('QA_ARTIFACT_PROJECT_MISMATCH');
}
if (violations.length) {
  for (const path of violations.slice(0, 25)) process.stderr.write('QA_ARTIFACT_PRODUCTION_REFERENCE: ' + path + '\n');
  throw new Error('QA_ARTIFACT_NOT_ISOLATED: ' + violations.length + ' paths');
}
process.stdout.write('QA_ARTIFACT_PASS: ' + inspected + ' text artifacts inspected. Build only, not runtime certified.\n');
