#!/usr/bin/env node
/**
 * End-to-end authorization proof using exclusively disposable emulators.
 * Tests real Firebase Auth ID tokens + server-side account/workspace lookup
 * through IAM-emulated REST; no credentials or production data are used.
 */
import assert from 'node:assert/strict';
import { verifyPlatformPrincipal, PlatformAuthorizationError } from '../lib/server/platformAuthorization';
import { evaluateServerAuthorization } from '../lib/server/authorizationPolicy';
import { assertWarehouseAuthorization } from '../lib/server/warehouseAccess';
import { GET as getSuppliers, POST as saveSupplier } from '../app/api/core/suppliers/route';
import { POST as transactEmpenho } from '../app/api/core/empenhos/transact/route';
import { POST as deleteCommissions } from '../app/api/core/comissoes/bulk-delete/route';

process.env.EMPROVEX_E2E_SERVER_AUTH = '1';
process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID = 'demo-emprovex-security';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const project='demo-emprovex-security';
const auth='http://127.0.0.1:9099';
const fs='http://127.0.0.1:8080/v1/projects/'+project+'/databases/(default)/documents';
const pass='Strong-emulator-only-Pass2026!';
const email='authz-sector@example.test',ws='ws-authorization-demo',ug='160500';

async function authApi(endpoint:string, body:Record<string,unknown>, admin=false) {
  const resp=await fetch(auth+'/identitytoolkit.googleapis.com/v1/'+endpoint+'?key=fake-api-key',{
    method:'POST',
    headers:{'content-type':'application/json',...(admin?{authorization:'Bearer owner'}:{})},
    body:JSON.stringify(body),
  });
  const result=await resp.json() as Record<string,any>;
  assert.equal(resp.ok,true,'Auth emulator '+endpoint+': '+JSON.stringify(result));
  return result;
}
async function document(path:string, values:Record<string,string>) {
  const fields=Object.fromEntries(Object.entries(values).map(([key,v])=>[key,{stringValue:v}]));
  const response=await fetch(fs+'/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},
    body:JSON.stringify({fields}),
  });
  assert.equal(response.ok,true,'Firestore seed: '+path+' '+await response.text());
}
async function verifyEmail(idToken:string, address:string) {
  await authApi('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken});
  const response=await fetch(auth+'/emulator/v1/projects/'+project+'/oobCodes');
  assert.equal(response.ok,true);
  const codes=await response.json() as {oobCodes?:Array<{email:string,requestType:string,oobLink:string}>};
  const match=[...(codes.oobCodes||[])].reverse()
    .find(x=>x.email===address&&x.requestType==='VERIFY_EMAIL');
  assert.ok(match?.oobLink,'verification link missing');
  assert.equal((await fetch(match.oobLink)).ok,true,'verification failed');
}
async function bearer(address:string):Promise<{token:string,uid:string}> {
  const signup=await authApi('accounts:signUp',{
    email:address,password:pass,returnSecureToken:true,
  });
  await verifyEmail(signup.idToken,address);
  const signed=await authApi('accounts:signInWithPassword',{
    email:address,password:pass,returnSecureToken:true,
  });
  return {token:'Bearer '+signed.idToken,uid:signed.localId};
}
async function rejected(fn:()=>Promise<unknown>,status=403) {
  await assert.rejects(fn,(error:unknown)=>{
    assert.ok(error instanceof PlatformAuthorizationError || (typeof error==='object'&&error!==null&&'status' in error));
    assert.equal((error as {status:number}).status,status);
    return true;
  });
}
async function main() {
  const sector=await bearer(email);
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await document('workspaces/'+ws,{
    id:ws,status:'active',authorizedEmail:email,ug,
  });
  const valid=await verifyPlatformPrincipal(sector.token);
  assert.equal(valid.uid,sector.uid);
  assert.equal(valid.role,'sector');
  assert.equal(valid.workspaceId,ws);
  assert.equal(valid.ug,ug);
  assert.deepEqual(evaluateServerAuthorization(valid,{capability:'warehouse.read',workspaceId:ws}),{allowed:true});
  assertWarehouseAuthorization({...valid,claimsUpdated:false},{capability:'warehouse.command',workspaceId:ws,operation:'TRANSFER'});
  assert.throws(()=>assertWarehouseAuthorization({...valid,claimsUpdated:false},{
    capability:'warehouse.command',workspaceId:'other-workspace',operation:'TRANSFER',
  }),/Operação não autorizada/);
  console.log('PASS: verified Firebase token + active IAM directory + tenant-scoped command');
  const supplier={id:'supplier_11222333000181',cnpj:'11222333000181',
    legalName:'Fornecedor de teste 01',email:'fornecedor@example.test',
    phone:'55991112222',whatsapp:'55991112222',
    createdAt:'2026-01-01T00:00:00.000Z',
    updatedAt:'2026-01-01T00:00:00.000Z',updatedBy:'forged-by-client'};
  const write=await saveSupplier(new Request('http://localhost/api/core/suppliers',{
    method:'POST',headers:{authorization:sector.token,'content-type':'application/json'},
    body:JSON.stringify({supplier}),
  }));
  assert.equal(write.status,200,'server supplier write');
  const writeData=await write.json() as {ok:boolean,item:{updatedBy:string,createdAt:string}};
  assert.equal(writeData.ok,true);
  assert.equal(writeData.item.updatedBy,sector.uid,'authoritative updatedBy');
  assert.notEqual(writeData.item.createdAt,supplier.createdAt,'authoritative creation timestamp');
  const list=await getSuppliers(new Request('http://localhost/api/core/suppliers',{
    headers:{authorization:sector.token},
  }));
  assert.equal(list.status,200,'server supplier list');
  const listData=await list.json() as {ok:boolean,items:Array<{cnpj:string}>};
  assert.ok(listData.items.some(x=>x.cnpj===supplier.cnpj));
  console.log('PASS: supplier create/list over server IAM and no forged metadata');
  const optionalEmail=await saveSupplier(new Request('http://localhost/api/core/suppliers',{
    method:'POST',headers:{authorization:sector.token,'content-type':'application/json'},
    body:JSON.stringify({supplier:{...supplier,email:''}}),
  }));
  assert.equal(optionalEmail.status,200,'UI allows supplier without e-mail');
  const legacyId='legacy_supplier_01';
  await document('workspaces/'+ws+'/suppliers/'+legacyId,{
    id:legacyId,cnpj:'11222333000181',legalName:'Fornecedor legado',
    email:'',phone:'',whatsapp:'',createdAt:'2024-01-01T00:00:00.000Z',
    updatedAt:'2024-01-01T00:00:00.000Z',updatedBy:sector.uid,
  });
  const withLegacy=await getSuppliers(new Request('http://localhost/api/core/suppliers',{
    headers:{authorization:sector.token},
  }));
  assert.equal(withLegacy.status,200,'legacy supplier must be listable');
  const legacyResults=await withLegacy.json() as {items:Array<{id:string}>};
  assert.ok(legacyResults.items.some(x=>x.id===legacyId));
  const legacyUpdated=await saveSupplier(new Request('http://localhost/api/core/suppliers',{
    method:'POST',headers:{authorization:sector.token,'content-type':'application/json'},
    body:JSON.stringify({supplier:{...supplier,id:legacyId,email:''}}),
  }));
  assert.equal(legacyUpdated.status,200,'legacy supplier update allowed only if CNPJ matches');
  console.log('PASS: optional e-mail and existing supplier IDs preserved');

  const forged=await saveSupplier(new Request('http://localhost/api/core/suppliers',{
    method:'POST',headers:{authorization:sector.token,'content-type':'application/json'},
    body:JSON.stringify({supplier:{...supplier,workspaceId:'victim-workspace'}}),
  }));
  assert.equal(forged.status,400,'injected tenant metadata denied');
  console.log('PASS: forged workspace field rejected');


  const intruder=await bearer('authz-intruder@example.test');
  await rejected(()=>verifyPlatformPrincipal(intruder.token));
  console.log('PASS: no directory entry denied');

  const baseEmpenho={
    id:'2026NE008820',supplier:'Fornecedor E2E',description:'Teste transacional',
    date:'2026-10-24',status:'Ativo' as const,
    items:[{id:'item_1',name:'Arroz',unit:'KG',quantity:10,unitPrice:5,received:0}],
    updatedBy:'forged-client',revision:0,
  };
  const transact=async(mode:'create'|'update',empenho:unknown,token=sector.token)=>
    transactEmpenho(new Request('http://localhost/api/core/empenhos/transact',{
      method:'POST',headers:{authorization:token,'content-type':'application/json'},
      body:JSON.stringify({mode,empenho}),
    }));
  const created=await transact('create',baseEmpenho);
  assert.equal(created.status,200,'NE initial create transaction');
  const createdBody=await created.json() as {ok:boolean,result:{revision:number,updatedBy:string}};
  assert.equal(createdBody.result.revision,1);
  assert.equal(createdBody.result.updatedBy,sector.uid);
  const duplicate=await transact('create',baseEmpenho);
  assert.equal(duplicate.status,409,'concurrent duplicate NE');
  const stale=await transact('update',{...baseEmpenho,description:'stale revision'});
  assert.equal(stale.status,409,'stale revision');
  const updated=await transact('update',{...baseEmpenho,revision:1,description:'Novo título'});
  assert.equal(updated.status,200,'revision increment');
  const updatedBody=await updated.json() as {result:{revision:number,description:string}};
  assert.equal(updatedBody.result.revision,2);
  assert.equal(updatedBody.result.description,'Novo título');
  await document('workspaces/'+ws+'/settings/empenhoDelete_'+baseEmpenho.id,{
    id:'empenhoDelete_'+baseEmpenho.id,empenhoId:baseEmpenho.id,
    workspaceId:ws,type:'empenho-deletion-lock',
  });
  const locked=await transact('update',{...baseEmpenho,revision:2});
  assert.equal(locked.status,409,'NE deletion lock');
  const wrongTenant=await transact('update',{...baseEmpenho,revision:2},intruder.token);
  assert.equal(wrongTenant.status,403,'outsider cannot mutate NE');
  console.log('PASS: NE IAM create/update revision, duplicate, lock and outsider');
  await document('workspaces/'+ws+'/comissoes/comissao_demo_01',{
    id:'comissao_demo_01',mesReferencia:'2026-10',boletimNumero:'1',
  });
  await document('workspaces/'+ws+'/comissoes/comissao_demo_02',{
    id:'comissao_demo_02',mesReferencia:'2026-10',boletimNumero:'2',
  });
  const bulkDelete=await deleteCommissions(new Request('http://localhost/api/core/comissoes/bulk-delete',{
    method:'POST',headers:{authorization:sector.token,'content-type':'application/json'},
    body:JSON.stringify({ids:['comissao_demo_01','comissao_demo_02']}),
  }));
  assert.equal(bulkDelete.status,200,'atomic commission deletion');
  const afterDelete=await fetch(fs+'/workspaces/'+ws+'/comissoes/comissao_demo_01',{
    headers:{authorization:'Bearer owner'},
  });
  assert.equal(afterDelete.status,404,'commission must be deleted');
  const invalidDelete=await deleteCommissions(new Request('http://localhost/api/core/comissoes/bulk-delete',{
    method:'POST',headers:{authorization:sector.token,'content-type':'application/json'},
    body:JSON.stringify({ids:['../../victim']}),
  }));
  assert.equal(invalidDelete.status,400,'path injection rejected');
  const outsiderDelete=await deleteCommissions(new Request('http://localhost/api/core/comissoes/bulk-delete',{
    method:'POST',headers:{authorization:intruder.token,'content-type':'application/json'},
    body:JSON.stringify({ids:['comissao_demo_01']}),
  }));
  assert.equal(outsiderDelete.status,403,'unauthorized commission delete');
  console.log('PASS: atomic server commission deletion, path injection and outsider');


  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:intruder.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: UID mismatch denied');
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'disabled',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: disabled account denied');
  const blockedSupplier=await saveSupplier(new Request('http://localhost/api/core/suppliers',{
    method:'POST',headers:{authorization:sector.token,'content-type':'application/json'},
    body:JSON.stringify({supplier}),
  }));
  assert.equal(blockedSupplier.status,403,'suspended sector should not write supplier');
  console.log('PASS: supplier API denies suspended sectors');

  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  await document('workspaces/'+ws,{
    id:ws,status:'disabled',authorizedEmail:email,ug,
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: disabled workspace denied');
  await document('workspaces/'+ws,{
    id:ws,status:'active',authorizedEmail:email,ug:'999999',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: UG mismatch denied');
  await document('workspaces/'+ws,{
    id:ws,status:'active',authorizedEmail:email,ug,
  });
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'google.com',
  });
  await rejected(()=>verifyPlatformPrincipal(sector.token));
  console.log('PASS: wrong provider denied');
  await document('platformAccounts/'+email,{
    email,accountType:'sector',status:'active',firebaseUid:sector.uid,
    workspaceId:ws,ug,authProvider:'password',
  });
  const final=await verifyPlatformPrincipal(sector.token);
  assert.equal(final.workspaceId,ws);
  console.log('PASS: restored active identity');

  const guest=await rejected(()=>verifyPlatformPrincipal(null),401);
  void guest;
  console.log('PASS: unauthenticated denied');
  // This checks authorization in Warehouse without invoking claims materialization
  // for the sector; that separate behavior is covered by the existing Warehouse R2 smoke.
  assert.throws(()=>assertWarehouseAuthorization({...final,claimsUpdated:false},{
    capability:'warehouse.command',workspaceId:ws,operation:'LEDGER_MOVEMENT',
  }),/não autorizada/);
  console.log('PASS: arbitrary ledger mutation denied');
  console.log('SERVER_AUTHORIZATION_EMULATOR_PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
