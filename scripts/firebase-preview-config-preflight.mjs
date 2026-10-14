#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createPrivateKey } from 'node:crypto';
import { resolveFirebaseEnvironment, assertPreviewServiceAccount } from '../lib/firebaseEnvironment.mjs';
try {
  const baseline=JSON.parse(readFileSync(new URL('../firebase-applet-config.json',import.meta.url),'utf8'));
  const config=resolveFirebaseEnvironment(baseline,{
    environment:'preview',
    publicConfigJson:process.env.NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON,
    legacyWarehouseDatabaseId:process.env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID,
  });
  assertPreviewServiceAccount(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON,config.projectId);
  const account=JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);
  const key=createPrivateKey(account.private_key.replace(/\\n/g,'\n'));
  if(key.asymmetricKeyType !== 'rsa') throw new Error('invalid key');
  console.log(JSON.stringify({status:'CONFIG_VALID_ONLY_NOT_RUNTIME_CERTIFIED',projectId:config.projectId,coreDatabaseId:config.firestoreDatabaseId,warehouseDatabaseId:config.warehouseDatabaseId}));
} catch {
  // Never include raw JSON, exceptions from parsers, key material or tokens.
  console.error('FIREBASE_PREVIEW_PREFLIGHT_BLOCKED');
  process.exitCode=2;
}
