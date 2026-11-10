import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root=process.cwd();
const read=p=>readFileSync(path.join(root,p),'utf8');
const main=JSON.parse(read('firebase-applet-config.json'));
const company=JSON.parse(read('config/empresas-firebase-web.json'));
function walk(folder) {
 const files=[];
 for(const entry of readdirSync(path.join(root,folder))){
  const relative=path.posix.join(folder,entry),full=path.join(root,relative);
  if(statSync(full).isDirectory())files.push(...walk(relative));
  else if(/\.(ts|tsx|mjs|js)$/.test(entry) && !/\.test\.(ts|tsx|mjs|js)$/.test(entry))files.push(relative);
 }
 return files;
}
const clientFiles=[ ...walk('features/company'), ...walk('components/company'),
 ...walk('app/empresa'), ...walk('app/empresa-convite'), ...walk('app/entrar-empresa') ];
test('Frontend empresarial jamais importa o Auth do Firebase principal',()=>{
 for(const file of clientFiles) {
  const source=read(file);
  assert.doesNotMatch(source,/from\\s*['"][^'"]*lib\\/firebase['"]/, file);
 }
});
const serverFiles=[
 ...walk('lib/company'),...walk('lib/server/companyMembership'),
 ...walk('lib/server/companyProfiles'),...walk('app/api/company'),
 'lib/server/companySession.ts','lib/server/companyProvisioningAdmin.ts',
 'lib/server/companyAuthz/index.ts',
];
test('Firebase Empresas e principal têm identidades e bancos diferentes',()=>{
 assert.equal(company.projectId,'emprovex-empresas');
 assert.equal(company.firestoreDatabaseId,'(default)');
 assert.notEqual(company.projectId,main.projectId);
 assert.notEqual(company.firestoreDatabaseId,main.firestoreDatabaseId);
});
test('Nenhum transporte/guard empresarial importa a configuração militar',()=>{
 const forbidden=[
  /firebase-applet-config\.json/,
  /from\s*['"][^'"]*sectorProvisioningAdmin['"]/,
  /from\s*['"][^'"]*lib\/firebase['"]/,
 ];
 const exceptions=new Set(['lib/company/firebaseProjectClient.ts']);
 for(const file of serverFiles){
  if(exceptions.has(file))continue;
  const txt=read(file);
  for(const pattern of forbidden)assert.doesNotMatch(txt,pattern,file+' still depends on principal project');
 }
});
test('Portal EMPROVEX Empresas usa Auth independente; login militar fica isolado',()=>{
 for(const file of ['components/company/CompanySessionGate.tsx','components/company/CompanyOperationalModule.tsx']){
  assert.match(read(file),/companyAuth as auth/,file);
  assert.doesNotMatch(read(file),/from ['"][^'"]*lib\/firebase['"]/);
 }
 assert.match(read('app/login/page.tsx'),/import \{ auth, googleProvider \} from '..\/..\/lib\/firebase'/);
 assert.match(read('app/entrar-empresa/page.tsx'),/companyAuth/);
});
test('Backend live exige runtime isolado e identidade Cloud Run dedicada',()=>{
 const txt=read('lib/server/companyFirebaseRuntime.ts');
 assert.match(txt,/EMPROVEX_COMPANY_ISOLATED_RUNTIME/);
 assert.match(txt,/EMPROVEX_COMPANY_RUNTIME_PROJECT_ID/);
 assert.match(txt,/getCloudRunAccessToken/);
 assert.match(txt,/COMPANY_SERVICE_IDENTITY_REQUIRED/);
 assert.match(read('lib/server/companyAuthz/index.ts'),/isCompanyIsolatedRuntime/);
});
test('Issuer e audience do token empresarial vinculados ao projeto novo',()=>{
 const txt=read('lib/server/companyFirebaseAuth.ts');
 assert.match(txt,/audience: companyConfig\.projectId/);
 assert.match(txt,/securetoken\.google\.com\//);
 assert.doesNotMatch(txt,/issuer:\s*['"]https:\/\/securetoken\.google\.com\/gen-lang/);
});
test('Módulos militares não são editados pela migração',()=>{
 assert.match(read('lib/firebase.ts'),/firebase-applet-config\.json/);
 assert.match(read('lib/server/firebaseFounderAuth.ts'),/firebase-applet-config\.json/);
});
