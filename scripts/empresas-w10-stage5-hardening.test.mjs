import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  resolveUnselectedCompany, signProfileSelection, verifyProfileSelection,
} from '../lib/company/profiles/selection.mjs';
import { fiscalNumberKey, createFiscalStore } from '../lib/company/fiscal/issuance/firestoreStore.mjs';
import {
  cleanCnpj, selectVerifiedProfile, fiscalSubmissionGate,
} from '../features/company/fiscal/flow.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const A = 'company-qa-a', B = 'company-qa-b';
const secret = randomBytes(32).toString('base64url');
const principal = { uid: 'qa-owner', authTime: 1_700_000_000 };
const record = {
  id: 'fiscal-qa', companyId: A, workspaceId: A, issuerCnpj: '11222333000181',
  connectionId: 'qa-connection', environment: 'homologacao',
  series: 1, number: 22, orderId: 'qa-order', idempotencyKey: 'qa-intent',
  fingerprint: 'a'.repeat(64), revision: 1,
};
const meta = {
  idempotencyKey: record.idempotencyKey,
  fingerprint: record.fingerprint,
  numberKey: [A, record.issuerCnpj, 'homologacao', 1, 22].join(':'),
};

test('missing cookie refuses implicit fallback for A+B', () => {
  assert.throws(() => resolveUnselectedCompany(A, [A, B]),
    { code: 'PROFILE_SELECTION_REQUIRED', status: 403 });
});
test('single-company W0 session remains compatible', () => {
  assert.equal(resolveUnselectedCompany(A, [A]), A);
});
test('unknown primary or stale discovery cannot grant fallback', () => {
  assert.throws(() => resolveUnselectedCompany(A, [B]));
  assert.throws(() => resolveUnselectedCompany(A, [A, '../other']));
});
test('signed profile cookie expires exactly after 600 seconds', () => {
  const token = signProfileSelection(B, principal, secret, 1700001000);
  assert.equal(verifyProfileSelection(token, principal, secret, 1700001599), B);
  assert.throws(() => verifyProfileSelection(token, principal, secret, 1700001600),
    {code:'PROFILE_NOT_AUTHORIZED', status:403});
});
test('cookie tampering, UID/authTime mismatch denied', () => {
  const token = signProfileSelection(B, principal, secret, 1700001000);
  assert.throws(() => verifyProfileSelection(token.slice(0,-2)+'aa',principal,secret,1700001100));
  assert.throws(() => verifyProfileSelection(token,{...principal,uid:'member-b'},secret,1700001100));
  assert.throws(() => verifyProfileSelection(token,{...principal,authTime:principal.authTime+1},secret,1700001100));
});
test('the client gate exposes a separate explicit selection state and aborts focus requests',()=>{
  const ui=read('components/company/CompanySessionGate.tsx');
  assert.match(ui,/stage: 'select-profile'/);
  assert.match(ui,/resolveCompanySession\(user, controller\.signal\)/);
  assert.match(ui,/void validate\(true\)/);
  assert.match(ui,/abortRef\.current\?\.abort\(\)/);
  assert.match(ui,/key=\{gate\.session\.firebaseUid \+ ':' \+ gate\.session\.workspaceId\}/);
  assert.doesNotMatch(ui,/setGate\(\{ stage: 'checking' \}\); void validate\(\)/);
});
test('profile switcher has one global home and is available on mobile',()=>{
  const gate=read('components/company/CompanySessionGate.tsx');
  const fiscal=read('components/company/fiscal/FiscalIssuanceWorkspace.tsx');
  assert.match(gate,/<CompanyProfileSwitcher/);
  assert.doesNotMatch(gate,/hidden max-w-\[17rem\] lg:block/);
  assert.doesNotMatch(fiscal,/<CompanyProfileSwitcher/);
});
test('fiscal number key is rebuilt, not a freely prefixed identifier', async()=>{
  assert.equal(fiscalNumberKey(record),meta.numberKey);
  let calls=0;
  const store=createFiscalStore({read:async()=>{calls++;return null;},commit:async()=>{calls++;}});
  const forged=[meta.numberKey+':extra',A+':other:homologacao:1:22',
    A+':11222333000181:homologacao:1:23',B+':11222333000181:homologacao:1:22'];
  for(const numberKey of forged) await assert.rejects(
    store.reserve(record,{...meta,numberKey}),
    {code:'NFE_RESERVATION_INVALID',status:422}
  );
  assert.equal(calls,0,'a forged number key must fail before Firestore calls');
  await assert.rejects(store.reserve({...record,series:0},meta),{code:'NFE_RESERVATION_INVALID'});
});
test('CNPJ alphanumeric is preserved with no numeric fallback to WLG',()=>{
  assert.equal(cleanCnpj('00.000.000/E08G-12'),'00000000E08G12');
  const profile=selectVerifiedProfile({
    ok:true,activeCompanyId:A,profiles:[{companyId:A,workspaceId:A,
      cnpj:'00.000.000/E08G-12',name:'Empresa A'}],
  },A);
  assert.equal(profile.cnpj,'00000000E08G12');
  const gate=fiscalSubmissionGate({profile,connection:{state:'connected',environment:'homologacao',verifiedAt:'2026-11-08'},
    capabilities:{canIssue:true,companyId:A,issuerCnpj:profile.cnpj,environment:'homologacao'},
    confirmed:true,draft:{companyId:A,issuerCnpj:profile.cnpj},busy:false,uncertain:false});
  assert.equal(gate.code,'ALPHANUMERIC_PROVIDER_PENDING');
  assert.equal(gate.allowed,false);
});
test('series zero is rejected even if frontend receives a capability',()=>{
  const profile={companyId:A,workspaceId:A,cnpj:'11222333000181'};
  const connection={state:'connected',environment:'homologacao',verifiedAt:'2026-11-08'};
  const capabilities={canIssue:true,companyId:A,issuerCnpj:profile.cnpj,environment:'homologacao'};
  const draft={companyId:A,issuerCnpj:profile.cnpj,orderId:'order',
    recipientCnpj:'11222333000181',recipientName:'Destinatário',series:0,number:2,items:[{}]};
  assert.equal(fiscalSubmissionGate({profile,connection,capabilities,draft,
    confirmed:true,busy:false,uncertain:false}).code,'DRAFT_INVALID');
});
test('essential preference reaches routing without loading optional map tiles',()=>{
  const routing=read('features/company/routing/RoutingWorkspace.tsx');
  const map=read('features/company/routing/MapLibreView.tsx');
  assert.match(routing,/useCompanyEssentialMode\(\)/);
  assert.match(routing,/<MapLibreView essential=\{essential\}/);
  assert.match(map,/if\(!wanted\|\|essential\|\|!container\.current\)return/);
  assert.doesNotMatch(map,/style\.startsWith\('https:\/'\)/);
});
test('fiscal server POST remains disabled and unrelated military paths are untouched by this worker',()=>{
  const route=read('app/api/company/fiscal/nfe/route.ts');
  assert.match(route,/NFE_INTEGRATION_PENDING/);
  assert.match(route,/status:\s*503/);
});
