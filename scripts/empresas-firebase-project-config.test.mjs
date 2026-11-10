import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const config=JSON.parse(readFileSync(new URL('../config/empresas-firebase-web.json',import.meta.url),'utf8'));
const main=JSON.parse(readFileSync(new URL('../firebase-applet-config.json',import.meta.url),'utf8'));
const client=readFileSync(new URL('../lib/company/firebaseProjectClient.ts',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../lib/firebase.ts',import.meta.url),'utf8');

test('Empresas: projeto isolado do Firebase principal',()=>{
 assert.equal(config.projectId,'emprovex-empresas');
 assert.equal(config.firestoreDatabaseId,'(default)');
 assert.notEqual(config.projectId,main.projectId);
 assert.notEqual(config.firestoreDatabaseId,main.firestoreDatabaseId);
 assert.equal(config.authDomain,config.projectId+'.firebaseapp.com');
 assert.match(config.appId,/^1:\d+:web:[a-zA-Z0-9]+$/);
 assert.equal(config.messagingSenderId,'372561217271');
});

test('Empresas: SDK web nomeado sem substituicao de app/Auth/Firestore militar',()=>{
 assert.match(client,/getApps\(\)/);
 assert.match(client,/initializeApp\(activeConfig, APP_NAME\)/);
 assert.match(client,/getAuth\(companyFirebaseApp\)/);
 assert.match(client,/getFirestore\(companyFirebaseApp, COMPANY_FIRESTORE_DATABASE_ID\)/);
 assert.match(legacy,/firebase-applet-config\.json/);
 assert.doesNotMatch(legacy,/empresas-firebase-web\.json/);
});

test('Empresas: emuladores usam apenas projeto demo com localhost',()=>{
 assert.match(client,/\^demo-/);
 assert.match(client,/COMPANY_FIREBASE_EMULATOR_PROJECT_REQUIRED/);
 assert.match(client,/COMPANY_FIREBASE_EMULATOR_ORIGIN_FORBIDDEN/);
 assert.match(client,/127\.0\.0\.1:9099/);
});

test('Empresas: configuracao cliente nao inclui credenciais administrativas',()=>{
 const serialized=JSON.stringify(config).toLowerCase();
 for(const text of ['private_key','client_secret','service_account','refresh_token','access_token']){
  assert.equal(serialized.includes(text),false);
 }
});
