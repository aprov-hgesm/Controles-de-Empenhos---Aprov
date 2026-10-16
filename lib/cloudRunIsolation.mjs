import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Strict staging contract. The target flag is server-controlled; K_SERVICE
 * independently detects Cloud Run at runtime. This does not replace IAM.
 * @param {Record<string, any>} baseline
 * @param {NodeJS.ProcessEnv | Record<string,string|undefined>} env
 */
export function assertCloudRunIsolation(baseline, env) {
  const target = (env.EMPROVEX_RUNTIME_TARGET || '').trim();
  const onCloudRun = Boolean((env.K_SERVICE || '').trim());
  if (!onCloudRun && !target) return null; // Preserve existing Vercel/local behavior.
  const fail = (reason) => { throw new Error('CLOUD_RUN_ISOLATION_' + reason); };
  if (target !== 'cloud-run-staging') fail('TARGET_REQUIRED');
  if (env.VERCEL_ENV) fail('MIXED_RUNTIME');
  if (env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1') fail('EMULATOR_IN_CLOUD');
  if (env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS ||
      env.EMPROVEX_GCP_MONITORING_PRIVATE_KEY) fail('KEY_MATERIAL_FORBIDDEN');

  let config;
  try { config = JSON.parse(env.NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON || ''); }
  catch { fail('PUBLIC_CONFIG_REQUIRED'); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('PUBLIC_CONFIG_REQUIRED');
  const required = ['projectId', 'appId', 'apiKey', 'authDomain', 'firestoreDatabaseId',
    'warehouseDatabaseId', 'storageBucket', 'messagingSenderId'];
  const allowed = new Set([...required, 'measurementId']);
  if (Object.keys(config).some((key) => !allowed.has(key))) fail('PUBLIC_CONFIG_FIELDS');
  for (const key of required) {
    if (typeof config[key] !== 'string' || !config[key].trim() ||
        config[key] !== config[key].trim()) fail('PUBLIC_CONFIG_FIELDS');
  }
  if (config.measurementId !== undefined && typeof config.measurementId !== 'string') fail('PUBLIC_CONFIG_FIELDS');
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)) fail('PROJECT_INVALID');
  const expectedProject = (env.EMPROVEX_CLOUD_PROJECT_ID || '').trim();
  if (!expectedProject || config.projectId !== expectedProject || config.projectId === baseline.projectId)
    fail('PROJECT_MISMATCH');
  if (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== expectedProject)
    fail('MANAGED_PROJECT_MISMATCH');
  if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== expectedProject)
    fail('MANAGED_PROJECT_MISMATCH');
  if (config.authDomain !== config.projectId + '.firebaseapp.com' ||
      config.authDomain === baseline.authDomain) fail('AUTH_DOMAIN_MISMATCH');
  if (![config.projectId + '.firebasestorage.app', config.projectId + '.appspot.com']
    .includes(config.storageBucket) || config.storageBucket === baseline.storageBucket)
    fail('STORAGE_MISMATCH');
  if (config.apiKey === baseline.apiKey || config.appId === baseline.appId ||
      !/^1:\d+:web:[a-zA-Z0-9]+$/.test(config.appId) ||
      !/^\d+$/.test(config.messagingSenderId) ||
      config.appId.split(':')[1] !== config.messagingSenderId)
    fail('APP_IDENTITY_MISMATCH');
  const dbPattern = /^(?:\(default\)|[a-z][a-z0-9-]{2,62})$/;
  if (!dbPattern.test(config.firestoreDatabaseId) ||
      !dbPattern.test(config.warehouseDatabaseId) ||
      config.firestoreDatabaseId === config.warehouseDatabaseId ||
      config.firestoreDatabaseId === baseline.firestoreDatabaseId ||
      config.warehouseDatabaseId === 'emprovex-warehouse')
    fail('DATABASE_ISOLATION_REQUIRED');
  if (!env.EMPROVEX_CLOUD_CORE_DATABASE_ID ||
      env.EMPROVEX_CLOUD_CORE_DATABASE_ID !== config.firestoreDatabaseId ||
      !env.EMPROVEX_CLOUD_WAREHOUSE_DATABASE_ID ||
      env.EMPROVEX_CLOUD_WAREHOUSE_DATABASE_ID !== config.warehouseDatabaseId ||
      (env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID &&
       env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID !== config.warehouseDatabaseId))
    fail('DATABASE_MISMATCH');
  return Object.freeze({ projectId: config.projectId,
    coreDatabaseId: config.firestoreDatabaseId,
    warehouseDatabaseId: config.warehouseDatabaseId });
}

/**
 * Build gate deliberately blocks Cloud Run until ALL static production imports
 * and identifiers are removed from executable source, not just the Firebase UI.
 * No network, credentials or data access.
 */
export function assertCloudRunBuildReady(baseline, env, root) {
  const context = assertCloudRunIsolation(baseline, env);
  if (!context) return null;
  const directories = ['app', 'lib', 'features', 'components', 'hooks', 'contexts', 'src'];
  const offenders = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
      const content = readFileSync(path, 'utf8');
      if (content.includes('firebase-applet-config.json') ||
          content.includes(baseline.projectId) ||
          content.includes(baseline.firestoreDatabaseId) ||
          /['"]emprovex-warehouse['"]/.test(content)) {
        offenders.push(relative(root, path));
      }
    }
  };
  directories.forEach((dir) => walk(join(root, dir)));
  if (offenders.length) {
    throw new Error('CLOUD_RUN_SOURCE_NOT_ISOLATED: ' + offenders.slice(0, 12).join(', ') +
      (offenders.length > 12 ? ' ...' : ''));
  }
  return context;
}
