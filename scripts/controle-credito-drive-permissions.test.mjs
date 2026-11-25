import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/server/creditDrivePermissions.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createCreditDrivePermissionAdapter,creditDriveViewUrl}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const owner='gestor@example.invalid',aprov='aprov@example.invalid',farm='farm@example.invalid',token='synthetic-test-token-1234567890';
const own={id:'owner',type:'user',role:'owner',emailAddress:owner};
function mock(initial=[own],settings={}){
  const permissions=structuredClone(initial),calls=[];
  let serial=0;
  const fetcher=async(input,init)=>{
    const url=new URL(input);
    assert.equal(url.origin,'https://www.googleapis.com');assert.ok(url.pathname.startsWith('/drive/v3/files/file123/permissions'));
    assert.equal(new Headers(init.headers).get('Authorization'),'Bearer '+token);assert.equal(init.redirect,'error');
    const method=init.method||'GET';calls.push({method,url:url.href});
    if(method==='GET'){
      if(settings.pages&&!url.searchParams.has('pageToken'))return Response.json({permissions:permissions.slice(0,1),nextPageToken:'second'});
      if(settings.pages)return Response.json({permissions:permissions.slice(1)});
      return Response.json({permissions});
    }
    if(method==='POST'){
      assert.equal(url.searchParams.get('sendNotificationEmail'),'false');
      const body=JSON.parse(init.body);assert.deepEqual(Object.keys(body).sort(),['emailAddress','role','type']);
      assert.equal(body.type,'user');assert.equal(body.role,'reader');assert.notEqual(body.emailAddress,owner);
      if(settings.failGrant)return Response.json({error:{}},{status:403});
      const p={id:'reader'+(++serial),...body};permissions.push(p);return Response.json(p);
    }
    if(method==='DELETE'){
      const id=url.pathname.split('/').pop();const idx=permissions.findIndex(p=>p.id===id);
      if(settings.failDelete)return Response.json({error:{}},{status:403});
      if(idx>=0&&!settings.noDelete)permissions.splice(idx,1);return new Response(null,{status:204});
    }
    throw Error('Unexpected operation');
  };
  return {permissions,calls,adapter:createCreditDrivePermissionAdapter(token,owner,{fetcher})};
}
const reader=(id,emailAddress)=>({id,type:'user',role:'reader',emailAddress});
const file='file123';
test('R1.6 grants only individual read, no notification, idempotent and no public link',async()=>{
  const {adapter,calls,permissions}=mock();
  await assert.rejects(adapter.reconcile(file,[aprov],[]),e=>e.code==='INVALID');
  assert.ok(calls.every(c=>c.method==='GET'));
  const first=await adapter.reconcile(file,[aprov],[aprov]);
  assert.equal(first.length,1);assert.equal(first[0].emailAddress,aprov);
  await adapter.reconcile(file,[aprov],[aprov]);assert.equal(calls.filter(c=>c.method==='POST').length,1);
  assert.equal(permissions.length,2);
  assert.equal(creditDriveViewUrl(file),'https://drive.google.com/file/d/file123/view');
  assert.throws(()=>creditDriveViewUrl('https://evil.invalid'));
});
test('R1.6 removes stale centre grants before adding and confirms full paginated ACL',async()=>{
  const {adapter,calls,permissions}=mock([own,reader('old',farm)],{pages:true});
  await adapter.reconcile(file,[aprov],[farm,aprov]);
  assert.ok(calls.findIndex(c=>c.method==='DELETE')<calls.findIndex(c=>c.method==='POST'));
  assert.deepEqual(permissions.filter(p=>p.role==='reader').map(p=>p.emailAddress),[aprov]);
  await adapter.reconcile(file,[],[aprov]);assert.deepEqual(permissions,[own]);
});
test('R1.6 refuses public, domain, writer, foreign owner or unregistered reader permissions',async()=>{
  for(const p of [{id:'public',type:'anyone',role:'reader'},{id:'domain',type:'domain',role:'reader'},{...reader('writer',farm),role:'writer'},reader('unknown',farm)]){
    const {adapter,calls}=mock([own,p]);await assert.rejects(adapter.reconcile(file,[aprov],[aprov]),e=>e.code==='UNSAFE_ACL');
    assert.ok(calls.every(c=>c.method==='GET'));
  }
  const {adapter}=mock([{...own,emailAddress:farm}]);await assert.rejects(adapter.list(file),e=>e.code==='UNSAFE_ACL');
});
test('R1.6 failed or unconfirmed revocation blocks new grants',async()=>{
  for(const settings of [{failDelete:true},{noDelete:true}]){
    const {adapter,calls}=mock([own,reader('old',farm)],settings);
    await assert.rejects(adapter.reconcile(file,[aprov],[aprov,farm]));
    assert.ok(!calls.some(c=>c.method==='POST'));
  }
});
test('R1.6 provider rejection never reports share as successful',async()=>{
  const {adapter}=mock([own],{failGrant:true});
  await assert.rejects(adapter.reconcile(file,[aprov],[aprov]),e=>e.code==='PROVIDER');
});

test('R1.6 revocation never restores an externally removed recipient',async()=>{
  const {adapter,calls,permissions}=mock([own,reader('old',farm)]);
  const actual=await adapter.reconcile(file,[aprov],[farm,aprov],false);
  assert.deepEqual(actual,[]);assert.deepEqual(permissions,[own]);assert.ok(!calls.some(c=>c.method==='POST'));
});
