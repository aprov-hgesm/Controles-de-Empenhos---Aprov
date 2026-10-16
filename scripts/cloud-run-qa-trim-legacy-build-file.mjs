/**
 * Remove a NEXT standalone file trace of the production Firebase baseline
 * from the QA packaging directory, never from repository source.
 * Must run AFTER W4 build gate and BEFORE artifact audit/startup smoke.
 */
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCloudRunIsolation } from '../lib/cloudRunIsolation.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const legacyFile = join(root, 'firebase-applet-config.json');
const expected = readFileSync(legacyFile, 'utf8');
const baseline = JSON.parse(expected);
assertCloudRunIsolation(baseline, process.env);
if (process.env.EMPROVEX_CLOUD_PROJECT_ID !== 'emprovex-qa-r1-261015-6275') {
  throw new Error('QA_TRIM_PROJECT_NOT_QA');
}
const traced = join(root, '.next', 'standalone', 'firebase-applet-config.json');
if (!existsSync(traced)) {
  process.stdout.write('QA_TRIM_OK: no legacy JSON in standalone\n');
} else {
  if (readFileSync(traced, 'utf8') !== expected) {
    throw new Error('QA_TRIM_FILE_CONTENT_CHANGED_OR_NOT_BUILD_TIME_BASELINE');
  }
  unlinkSync(traced);
  process.stdout.write('QA_TRIM_OK: removed traced legacy JSON from QA standalone only\n');
}
// A later startup smoke must prove the packaging does not require the removed file.
// Never modify the production source JSON or build with a synthetic image for deploy.
