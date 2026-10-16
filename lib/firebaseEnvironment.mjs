/**
 * Canonical public Firebase configuration for client SDK and server-side REST.
 * This module is pure so it can be tested with synthetic projects without I/O.
 * Secrets and IAM identity verification are NEVER provided by this module.
 */
export function resolveFirebaseEnvironment(baseline, options = {}) {
  const {
    environment = 'legacy',
    publicConfigJson,
    legacyWarehouseDatabaseId,
    emulatorEnabled = false,
    emulatorProjectId,
  } = options;
  const legacyWarehouse = legacyWarehouseDatabaseId?.trim() || 'emprovex-warehouse';
  const assert = (condition, code) => {
    if (!condition) throw new Error('FIREBASE_ENV_' + code);
  };

  if (environment === 'cloud-run-staging') {
    assert(!emulatorEnabled, 'STAGING_EMULATOR_FORBIDDEN');
    assert(Boolean(publicConfigJson?.trim()), 'STAGING_CONFIG_REQUIRED');
    let config;
    try { config = JSON.parse(publicConfigJson); }
    catch { throw new Error('FIREBASE_ENV_STAGING_CONFIG_INVALID'); }
    assert(config && typeof config === 'object' && !Array.isArray(config), 'STAGING_CONFIG_INVALID');
    const required = ['projectId', 'appId', 'apiKey', 'authDomain', 'firestoreDatabaseId',
      'warehouseDatabaseId', 'storageBucket', 'messagingSenderId'];
    const allowed = new Set([...required, 'measurementId']);
    assert(Object.keys(config).every(key => allowed.has(key)), 'STAGING_CONFIG_FIELDS');
    assert(required.every(key => typeof config[key] === 'string'
      && config[key].length > 0 && config[key] === config[key].trim()), 'STAGING_CONFIG_FIELDS');
    assert(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)
      && config.projectId !== baseline.projectId, 'STAGING_PROJECT_NOT_ISOLATED');
    assert(config.authDomain === config.projectId + '.firebaseapp.com'
      && config.authDomain !== baseline.authDomain, 'STAGING_AUTH_DOMAIN');
    assert([config.projectId + '.firebasestorage.app', config.projectId + '.appspot.com']
      .includes(config.storageBucket) && config.storageBucket !== baseline.storageBucket,
    'STAGING_STORAGE');
    assert(config.apiKey !== baseline.apiKey
      && config.appId !== baseline.appId
      && /^1:\d+:web:[a-zA-Z0-9]+$/.test(config.appId)
      && /^\d+$/.test(config.messagingSenderId)
      && config.appId.split(':')[1] === config.messagingSenderId, 'STAGING_APP_IDENTITY');
    const dbPattern = /^(?:\(default\)|[a-z][a-z0-9-]{2,62})$/;
    assert(dbPattern.test(config.firestoreDatabaseId)
      && dbPattern.test(config.warehouseDatabaseId)
      && config.firestoreDatabaseId !== config.warehouseDatabaseId
      && config.firestoreDatabaseId !== baseline.firestoreDatabaseId
      && config.warehouseDatabaseId !== 'emprovex-warehouse', 'STAGING_DATABASES_NOT_ISOLATED');
    // A legacy Warehouse override may exist on a deployment and must never
    // silently redirect staging to a second database.
    if (legacyWarehouseDatabaseId?.trim()) {
      assert(legacyWarehouseDatabaseId.trim() === config.warehouseDatabaseId,
        'STAGING_WAREHOUSE_OVERRIDE_CONFLICT');
    }
    return Object.freeze({...config});
  }

  assert(environment === 'legacy', 'UNRECOGNIZED_RUNTIME');
  assert(!publicConfigJson?.trim(), 'LEGACY_STAGING_OVERRIDE_FORBIDDEN');
  if (emulatorEnabled) {
    assert(typeof emulatorProjectId === 'string' && /^demo-[a-z0-9-]+$/.test(emulatorProjectId),
      'EMULATOR_PROJECT_REQUIRED');
    return Object.freeze({
      ...baseline,
      projectId: emulatorProjectId,
      authDomain: emulatorProjectId + '.firebaseapp.com',
      firestoreDatabaseId: '(default)',
      warehouseDatabaseId: legacyWarehouse,
    });
  }
  return Object.freeze({...baseline, warehouseDatabaseId: legacyWarehouse});
}
