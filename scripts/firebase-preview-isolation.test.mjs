import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveFirebaseEnvironment } from '../lib/firebaseEnvironment.mjs';
const baseline=JSON.parse(readFileSync(new URL('../firebase-applet-config.json',import.meta.url),'utf8'));
const preview={projectId:'emprovex-preview-test',appId:'1:123456:web:abc123',apiKey:'synthetic-public-key',authDomain:'emprovex-preview-test.firebaseapp.com',firestoreDatabaseId:'preview-core',warehouseDatabaseId:'preview-warehouse',storageBucket:'emprovex-preview-test.firebasestorage.app',messagingSenderId:'123456'};
const resolve=(config=preview,options={})=>resolveFirebaseEnvironment(baseline,{environment:'preview',publicConfigJson:JSON.stringify(config),...options});
test('production and local retain baseline and legacy Warehouse default',()=>{
 for(const environment of ['production','local','development']) {
  assert.deepEqual(resolveFirebaseEnvironment(baseline,{environment}),{...baseline,warehouseDatabaseId:'emprovex-warehouse'});
 }
});
test('complete isolated public config routes main and Warehouse together',()=>assert.deepEqual(resolve(),preview));
for(const [name,config] of [
 ['production project',{...preview,projectId:baseline.projectId}],
 ['production auth domain',{...preview,authDomain:baseline.authDomain}],
 ['production bucket',{...preview,storageBucket:baseline.storageBucket}],
 ['production api key',{...preview,apiKey:baseline.apiKey}],
 ['production app',{...preview,appId:baseline.appId}],
 ['missing database',{...preview,warehouseDatabaseId:''}],
 ['unified databases',{...preview,warehouseDatabaseId:preview.firestoreDatabaseId}],
 ['project path injection',{...preview,projectId:'other/projects/real'}],
 ['database path injection',{...preview,firestoreDatabaseId:'core/documents/x'}],
 ['secret property',{...preview,private_key:'never-log-this'}],
 ['null',null], ['array',[]],
]) test('fail closed: '+name,()=>assert.throws(()=>resolve(config),/^Error: FIREBASE_PREVIEW_ISOLATION_REQUIRED$/));
test('Preview without config or invalid JSON fails closed',()=>{
 for(const publicConfigJson of [undefined,'','{invalid']) assert.throws(()=>resolveFirebaseEnvironment(baseline,{environment:'preview',publicConfigJson}),/ISOLATION_REQUIRED/);
});
test('client Warehouse override cannot diverge from server config',()=>assert.throws(()=>resolve(preview,{legacyWarehouseDatabaseId:'emprovex-warehouse'}),/ISOLATION_REQUIRED/));
test('non-Preview cannot accidentally apply Preview override',()=>assert.throws(()=>resolveFirebaseEnvironment(baseline,{environment:'production',publicConfigJson:JSON.stringify(preview)}),/OVERRIDE_REQUIRES_PREVIEW/));
test('all runtime consumers use central config and only central config imports baseline',()=>{
 for(const file of ['lib/firebase.ts','lib/server/firebaseFounderAuth.ts','lib/server/warehouseAccess.ts','lib/server/sectorProvisioningAdmin.ts','lib/server/sectorLifecycleAdmin.ts','lib/server/firebaseAuthBackup.ts','lib/server/googleCloudMonitoring.ts','lib/server/globalUsageHistory.ts','app/api/billing/regularization/route.ts','app/api/adm-deposito/intake-action/route.ts']) {
  const source=readFileSync(file,'utf8');
  assert.match(source,/import firebaseConfig(?:, \{[^}]+\})? from ['"].*firebaseRuntimeConfig['"]/);
  assert.doesNotMatch(source,/firebase-applet-config\.json/);
 }
 for(const file of ['app/api/adm-deposito/intake-action/route.ts','lib/server/sectorLifecycleAdmin.ts']) assert.match(readFileSync(file,'utf8'),/WAREHOUSE_DATABASE_ID = firebaseConfig\.warehouseDatabaseId/);
});

import { assertPreviewServiceAccount } from '../lib/firebaseEnvironment.mjs';
const account={type:'service_account',project_id:preview.projectId,client_email:`test@${preview.projectId}.iam.gserviceaccount.com`,private_key:'-----BEGIN PRIVATE KEY-----\nSYNTHETIC_NOT_A_REAL_KEY\n-----END PRIVATE KEY-----',token_uri:'https://oauth2.googleapis.com/token'};
test('Preview requires its own declared service identity',()=>assert.doesNotThrow(()=>assertPreviewServiceAccount(JSON.stringify(account),preview.projectId)));
for(const [name,patch] of [['foreign project',{project_id:baseline.projectId}],['foreign identity',{client_email:'test@real-project.iam.gserviceaccount.com'}],['missing key',{private_key:''}],['foreign OAuth endpoint',{token_uri:'https://untrusted.example/token'}]]) test('admin fail closed: '+name,()=>assert.throws(()=>assertPreviewServiceAccount(JSON.stringify({...account,...patch}),preview.projectId),/^Error: FIREBASE_PREVIEW_ADMIN_CONFIGURATION_REQUIRED$/));
test('admin errors never echo malformed input or secrets',()=>{
 for(const raw of [undefined,'private_key: do-not-echo-this','null']) assert.throws(()=>assertPreviewServiceAccount(raw,preview.projectId),/^Error: FIREBASE_PREVIEW_ADMIN_CONFIGURATION_REQUIRED$/);
});

import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
test('preflight validates generated RSA locally and prints only target identifiers',()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:1024,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const env={...process.env,NEXT_PUBLIC_EMPROVEX_FIREBASE_CONFIG_JSON:JSON.stringify(preview),FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:JSON.stringify({...account,private_key:privateKey})};
 delete env.NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID;
 const result=spawnSync(process.execPath,['scripts/firebase-preview-config-preflight.mjs'],{env,encoding:'utf8'});
 assert.equal(result.status,0);
 assert.deepEqual(JSON.parse(result.stdout),{status:'CONFIG_VALID_ONLY_NOT_RUNTIME_CERTIFIED',projectId:preview.projectId,coreDatabaseId:preview.firestoreDatabaseId,warehouseDatabaseId:preview.warehouseDatabaseId});
 assert.equal(result.stderr,'');
 assert.equal(result.stdout.includes(privateKey),false);
 const invalid=spawnSync(process.execPath,['scripts/firebase-preview-config-preflight.mjs'],{env:{...env,FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'do-not-echo-this'},encoding:'utf8'});
 assert.equal(invalid.status,2);
 assert.equal(invalid.stderr.trim(),'FIREBASE_PREVIEW_PREFLIGHT_BLOCKED');
 assert.equal(invalid.stdout,'');
});
