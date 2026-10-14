/**
 * Public Firebase configuration only. Never accepts service-account credentials.
 * @param {{projectId:string,appId:string,apiKey:string,authDomain:string,firestoreDatabaseId:string,storageBucket:string,messagingSenderId:string,measurementId?:string}} baseline
 * @param {{environment?:string,publicConfigJson?:string,legacyWarehouseDatabaseId?:string}} options
 */
export function resolveFirebaseEnvironment(baseline, options = {}) {
  const environment = options.environment || 'local';
  const warehouseDefault = options.legacyWarehouseDatabaseId?.trim() || 'emprovex-warehouse';
  if (environment !== 'preview') {
    if (options.publicConfigJson?.trim()) throw new Error('FIREBASE_CONFIG_OVERRIDE_REQUIRES_PREVIEW');
    return { ...baseline, warehouseDatabaseId: warehouseDefault };
  }
  const fail = () => { throw new Error('FIREBASE_PREVIEW_ISOLATION_REQUIRED'); };
  let config;
  try { config = JSON.parse(options.publicConfigJson || ''); } catch { return fail(); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) return fail();
  const required = ['projectId','appId','apiKey','authDomain','firestoreDatabaseId','warehouseDatabaseId','storageBucket','messagingSenderId'];
  const allowed = [...required, 'measurementId'];
  if (Object.keys(config).some(key => !allowed.includes(key))) return fail();
  for (const key of required) if (typeof config[key] !== 'string' || !config[key].trim()) return fail();
  if (config.measurementId !== undefined && typeof config.measurementId !== 'string') return fail();
  const result = Object.fromEntries(Object.entries(config).map(([key,value]) => [key, value.trim()]));
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(result.projectId) || result.projectId === baseline.projectId) return fail();
  if (result.authDomain !== `${result.projectId}.firebaseapp.com`) return fail();
  if (![`${result.projectId}.firebasestorage.app`,`${result.projectId}.appspot.com`].includes(result.storageBucket)) return fail();
  if (result.apiKey === baseline.apiKey || result.appId === baseline.appId || !/^1:\d+:web:[a-zA-Z0-9]+$/.test(result.appId)) return fail();
  if (!/^\d+$/.test(result.messagingSenderId) || result.appId.split(':')[1] !== result.messagingSenderId) return fail();
  const databasePattern = /^(?:\(default\)|[a-z][a-z0-9-]{2,62})$/;
  if (!databasePattern.test(result.firestoreDatabaseId) || !databasePattern.test(result.warehouseDatabaseId) || result.firestoreDatabaseId === result.warehouseDatabaseId) return fail();
  if (options.legacyWarehouseDatabaseId?.trim() && warehouseDefault !== result.warehouseDatabaseId) return fail();
  return /** @type {typeof baseline & {warehouseDatabaseId:string}} */ (result);
}

/** Validate locally, without OAuth calls or printing secret values.
 * @param {string|undefined} raw
 * @param {string} projectId
 */
export function assertPreviewServiceAccount(raw, projectId) {
  const fail = () => { throw new Error('FIREBASE_PREVIEW_ADMIN_CONFIGURATION_REQUIRED'); };
  let value;
  try { value=JSON.parse(raw || ''); } catch { return fail(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  if (value.project_id !== projectId || value.type !== 'service_account') return fail();
  if (typeof value.client_email !== 'string' || !value.client_email.endsWith(`@${projectId}.iam.gserviceaccount.com`)) return fail();
  if (typeof value.private_key !== 'string' || !value.private_key.replace(/\\n/g,'\n').trim().startsWith('-----BEGIN PRIVATE KEY-----')) return fail();
  if (value.token_uri && value.token_uri !== 'https://oauth2.googleapis.com/token') return fail();
}
