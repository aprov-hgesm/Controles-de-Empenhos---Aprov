/**
 * Worker W1: Auth/Firestore Emulator only. NEVER run with production credentials.
 * npx firebase-tools emulators:exec --config firebase.security-test.json
 * --project demo-emprovex-company-w1 --only auth,firestore
 * "node --test features/company/customers/w1-emulator.test.mjs"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { decodeJwt } from 'jose';

const nodeRequire=createRequire(import.meta.url);
const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID;
assert.match(project || '',/^demo-[a-z0-9-]+$/);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
assert.ok(!process.env.K_SERVICE && !process.env.VERCEL && !process.env.GAE_SERVICE);
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH,'1');
process.env.EMPROVEX_COMPANY_PILOT_ENABLED='1';

const config={projectId:project,apiKey:'fake-emprovex-w1-key',firestoreDatabaseId:'(default)'};
const authRoot='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const deps={};
function load(path, modules={}) {
  const source=readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
  },reportDiagnostics:true});
  assert.equal(js.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length || 0,0);
  const exports={};
  runInNewContext(js.outputText,{
    exports,
    require(id){
      if(Object.hasOwn(modules,id)) return modules[id];
      if(id.startsWith('node:')) return nodeRequire(id);
      throw new Error('Import proibido em '+path+': '+id);
    },
    fetch:(...args)=>globalThis.fetch(...args),
    process,console,AbortSignal,TextEncoder,URL,URLSearchParams,Request,Response,Buffer,
  },{filename:path});
  return exports;
}
deps.identity=load('lib/platformIdentity.ts');
deps.provisionModel=load('lib/companyProvisioning.ts',{'./platformIdentity':deps.identity});
deps.provision=load('lib/server/companyProvisioningAdmin.ts',{
  '../../firebase-applet-config.json':config,
  '../companyProvisioning':deps.provisionModel,
  '../platformIdentity':deps.identity,
  './sectorProvisioningAdmin':{getGoogleAccessToken:()=>{throw Error('REAL_GCP_FORBIDDEN');}},
});
class StubFounderAuthError extends Error {
  constructor(message,status){super(message);this.status=status;}
}
async function checkLocalToken(bearer){
  if(!bearer?.startsWith('Bearer ')) throw new StubFounderAuthError('invalid',401);
  let p;try{p=decodeJwt(bearer.slice(7));}catch{throw new StubFounderAuthError('invalid',401);}
  if(p.iss!=='https://securetoken.google.com/'+project || p.aud!==project ||
    typeof p.exp!=='number' || p.exp<=Date.now()/1000 || p.email_verified!==true) {
    throw new StubFounderAuthError('invalid',401);
  }
  return {idToken:bearer.slice(7),uid:p.sub,email:deps.identity.normalizePlatformEmail(p.email),
    signInProvider:p.firebase?.sign_in_provider || ''};
}
deps.session=load('lib/server/companySession.ts',{
  '../../firebase-applet-config.json':config,
  '../platformIdentity':deps.identity,
  './firebaseFounderAuth':{FounderAuthError:StubFounderAuthError,verifyFirebaseRequest:checkLocalToken},
  './sectorProvisioningAdmin':{getGoogleAccessToken:()=>{throw Error('REAL_GCP_FORBIDDEN');}},
});
deps.contracts=load('lib/company/contracts/index.ts',{'../../platformIdentity':deps.identity});
deps.guard=load('lib/server/companyAuthz/index.ts',{
  '../../company/contracts':deps.contracts,'../companySession':deps.session,
});
deps.model=load('lib/company/customers/model.ts',{'../contracts':deps.contracts});
deps.store=load('lib/company/customers/store.ts',{
  '../../../firebase-applet-config.json':config,
  '../contracts':deps.contracts,
  '../../server/sectorProvisioningAdmin':{getGoogleAccessToken:()=>{throw Error('REAL_GCP_FORBIDDEN');}},
  './model':deps.model,
});
deps.service=load('lib/company/customers/service.ts',{'./store':deps.store,'./model':deps.model});
deps.http=load('lib/company/customers/http.ts',{
  'next/server':{NextResponse:{json:(value,init)=>Response.json(value,init)}},
  '../../server/companyAuthz':deps.guard,'../../server/companySession':deps.session,
  './model':deps.model,'./service':deps.service,
});
const collections={
  customers:deps.http.collectionRoutes('publicCustomers'),
  commitments:deps.http.collectionRoutes('commitments'),
  orders:deps.http.collectionRoutes('customerOrders'),
};
const items={
  customers:deps.http.itemRoutes('publicCustomers'),
  commitments:deps.http.itemRoutes('commitments'),
  orders:deps.http.itemRoutes('customerOrders'),
};
function taxId(num) {
  const base=String(112223330000+num);
  function digit(s,weights){const v=[...s].reduce((sum,ch,i)=>sum+Number(ch)*weights[i],0)%11;
    return String(v<2?0:11-v);}
  const first=base+digit(base,[5,4,3,2,9,8,7,6,5,4,3,2]);
  return first+digit(first,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
}
async function login(email,password) {
  const r=await fetch(authRoot+'/accounts:signInWithPassword?key=fake-emprovex-w1-key',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password,returnSecureToken:true}),
  });
  assert.equal(r.status,200,'Auth Emulator sign-in');
  return (await r.json()).idToken;
}
function req(token,method='GET',body,key='unit-test-key-0001'){
  return new Request('http://localhost/api/company/w1',{method,
    headers:{...(token?{authorization:'Bearer '+token}:{}),
      ...(body?{'content-type':'application/json','idempotency-key':key}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
}
async function post(domain,token,body,key){
  const r=await collections[domain].POST(req(token,'POST',body,key));
  return {status:r.status,payload:await r.json()};
}
async function get(domain,token,id) {
  const r=await items[domain].GET(req(token),{params:Promise.resolve({id})});
  return {status:r.status,payload:await r.json()};
}
async function listing(domain,token,cursor) {
  const path='http://localhost/api/company/'+domain+'?limit=1'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
  const r=await collections[domain].GET(new Request(path,{headers:{authorization:'Bearer '+token}}));
  return {status:r.status,payload:await r.json()};
}
let tokenA='',tokenB='',companyA='',companyB='',customerId='',neId='',orderId='';
const price={amountCents:1800,currency:'BRL'};
const q=value=>({value,unit:'UN'});

test('W1 setup: duas empresas reais no Auth/Firestore Emulator',async()=>{
  const password='FakePassW1-2026!!';
  const founder={uid:'founder-demo-uid',email:'founder@example.invalid'};
  const a=await deps.provision.provisionCompanyWorkspaceWithAuth({
    workspaceId:'company-w1-A'.toLowerCase(),legalName:'Empresa W1 A',cnpj:taxId(9),
    responsibleName:'QA',authorizedEmail:'company-w1-a@example.invalid',
    initialPassword:password,city:'Santa Maria',state:'RS'},founder);
  const b=await deps.provision.provisionCompanyWorkspaceWithAuth({
    workspaceId:'company-w1-B'.toLowerCase(),legalName:'Empresa W1 B',cnpj:taxId(10),
    responsibleName:'QA',authorizedEmail:'company-w1-b@example.invalid',
    initialPassword:password,city:'Santa Maria',state:'RS'},founder);
  companyA=a.account.workspaceId;companyB=b.account.workspaceId;
  tokenA=await login(a.account.email,password);tokenB=await login(b.account.email,password);
  assert.notEqual(companyA,companyB);
});
test('W1: 401 sem token e 403 para usuário da OM/setor',async()=>{
  const unauth=await collections.customers.GET(req(null));
  assert.equal(unauth.status,401);
  await assert.rejects(deps.guard.requireCompanyContext(req(tokenA),{
    action:'publicCustomers:read',companyId:companyB,
  }),e=>e.status===403);
});
test('W1: cadastro e paginação não enumeram outro tenant',async()=>{
  const input={kind:'military_organization',name:'OM Pública',ug:'160416',
    addresses:[{label:'Sede',street:'Rua QA',city:'Santa Maria',state:'RS'}],
    contacts:[{name:'Comissão QA'}]};
  const a=await post('customers',tokenA,input,'create-customer-001');
  assert.equal(a.status,201,JSON.stringify(a.payload));
  customerId=a.payload.result.id;
  const replay=await post('customers',tokenA,input,'create-customer-001');
  assert.equal(replay.status,201);assert.equal(replay.payload.result.id,customerId);
  const b=await get('customers',tokenB,customerId);assert.equal(b.status,404);
  const listA=await listing('customers',tokenA);assert.equal(listA.status,200);
  assert.equal(listA.payload.result.items.length,1);
  const listB=await listing('customers',tokenB);assert.equal(listB.status,200);
  assert.equal(listB.payload.result.items.length,0);
  const conflict=await post('customers',tokenA,{...input,name:'Outra OM'},'create-customer-001');
  assert.equal(conflict.status,409);
});
test('W1: NE distinta do pedido, duas solicitações e saldo reservado',async()=>{
  const ne={publicCustomerId:customerId,neNumber:'2026NE000001',fiscalYear:2026,
    extractionSource:'manual',lines:[{id:'item-1',description:'Material A',
      quantity:q('500'),salePrice:price}]};
  const created=await post('commitments',tokenA,ne,'create-ne-0000001');
  assert.equal(created.status,201,JSON.stringify(created.payload));neId=created.payload.result.id;
  const order=amount=>({publicCustomerId:customerId,commitmentId:neId,
    reference:'Pedido de '+amount,lines:[{id:'line-1',commitmentLineId:'item-1',quantity:q(amount)}]});
  const first=await post('orders',tokenA,order('100'),'order-create-0001');
  assert.equal(first.status,201,JSON.stringify(first.payload));orderId=first.payload.result.id;
  const second=await post('orders',tokenA,order('300'),'order-create-0002');
  assert.equal(second.status,201,JSON.stringify(second.payload));
  const repeat=await post('orders',tokenA,order('300'),'order-create-0002');
  assert.equal(repeat.status,201);assert.equal(repeat.payload.result.id,second.payload.result.id);
  const neStored=await get('commitments',tokenA,neId);
  assert.equal(neStored.payload.result.lines[0].orderedQuantity.value,'400');
  const denial=await get('commitments',tokenB,neId);assert.equal(denial.status,404);
});
test('W1: concorrência no último saldo permite apenas uma reserva',async()=>{
  const make=ref=>({publicCustomerId:customerId,commitmentId:neId,reference:ref,
    lines:[{id:'line-1',commitmentLineId:'item-1',quantity:q('100')}]});
  const res=await Promise.all([
    post('orders',tokenA,make('Corrida A'),'racing-order-0001'),
    post('orders',tokenA,make('Corrida B'),'racing-order-0002'),
  ]);
  assert.deepEqual(res.map(x=>x.status).sort(),[201,409]);
  const neStored=await get('commitments',tokenA,neId);
  assert.equal(neStored.payload.result.lines[0].orderedQuantity.value,'500');
});
test('W1: preço negociado exige justificativa, sem virar custo',async()=>{
  const ne={publicCustomerId:customerId,commitmentId:neId,reference:'Preço negociado',
    lines:[{id:'line-1',commitmentLineId:'item-1',quantity:q('1'),
      salePrice:{amountCents:1200,currency:'BRL'}}]};
  const result=await post('orders',tokenA,ne,'negotiation-0001');
  assert.equal(result.status,400); // sem justificativa: validado antes da alocação
});
test('W1: cancelamento auditável libera quantidade sem deletar pedido',async()=>{
  const existing=await get('orders',tokenA,orderId);
  assert.equal(existing.status,200);
  const route=items.orders;
  const patchReq=req(tokenA,'PATCH',{cancel:true,expectedRevision:existing.payload.result.revision},'cancel-order-0001');
  const response=await route.PATCH(patchReq,{params:Promise.resolve({id:orderId})});
  assert.equal(response.status,200,await response.text());
  const after=await get('commitments',tokenA,neId);
  assert.equal(after.payload.result.lines[0].orderedQuantity.value,'400');
  const cancelled=await get('orders',tokenA,orderId);
  assert.equal(cancelled.payload.result.status,'cancelled');
});
test('W1: preço negociado com justificativa registra preço de venda, não custo',async()=>{
  const data={publicCustomerId:customerId,commitmentId:neId,reference:'Pedido negociado',
    negotiationNote:'Condição comercial confirmada pela OM',
    lines:[{id:'line-1',commitmentLineId:'item-1',quantity:q('100'),
      salePrice:{amountCents:1200,currency:'BRL'}}]};
  const result=await post('orders',tokenA,data,'negotiation-confirm-01');
  assert.equal(result.status,201,JSON.stringify(result.payload));
  assert.equal(result.payload.result.lines[0].salePrice.amountCents,1200);
  assert.equal('cost' in result.payload.result.lines[0],false);
  const after=await get('commitments',tokenA,neId);
  assert.equal(after.payload.result.lines[0].orderedQuantity.value,'500');
});
test('W1: piloto OFF = 503; conta A não recebe fallback',async()=>{
  process.env.EMPROVEX_COMPANY_PILOT_ENABLED='0';
  try{const r=await collections.customers.GET(req(tokenA));assert.equal(r.status,503);}
  finally{process.env.EMPROVEX_COMPANY_PILOT_ENABLED='1';}
});
