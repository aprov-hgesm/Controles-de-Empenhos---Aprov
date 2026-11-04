import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFounderUg } from './repair-hgesm-founder-ug-one-shot.mjs';
const str = stringValue => ({ stringValue });
const ws = { fields: { id:str('hgesm-aprov'),authorizedEmail:str('aprov1hgesm@gmail.com'),status:str('active'),ug:str('160416') }, updateTime:'2026-11-01T10:00:00Z' };
const acc = { fields: { email:str('aprov1hgesm@gmail.com'),workspaceId:str('hgesm-aprov'),accountType:str('sector'),status:str('active') }, updateTime:'2026-11-01T10:00:00Z' };

test('Missing founder account UG is the only authorized mutation',()=>{
  assert.equal(classifyFounderUg(ws,acc),'missing-ug');
  assert.equal(classifyFounderUg(ws,{...acc,fields:{...acc.fields,ug:{nullValue:null}}}),'missing-ug');
});
test('Already correct remains no-op',()=>assert.equal(classifyFounderUg(ws,{...acc,fields:{...acc.fields,ug:str('160416')}}),'already-consistent'));
test('Different real UG is not changed',()=>assert.throws(()=>classifyFounderUg(ws,{...acc,fields:{...acc.fields,ug:str('160417')}}),/UNEXPECTED/));
test('Refuse inactive account, wrong workspace, status, identity, or workspace UG',()=>{
  for(const [doc,key,value] of [
    ['ws','ug',str('160999')],['ws','status',str('disabled')],
    ['acc','status',str('inactive')],['acc','workspaceId',str('other')],
    ['acc','accountType',str('company')],['acc','email',str('someone@example.com')]
  ]){
    const w=doc==='ws'?{...ws,fields:{...ws.fields,[key]:value}}:ws;
    const a=doc==='acc'?{...acc,fields:{...acc.fields,[key]:value}}:acc;
    assert.throws(()=>classifyFounderUg(w,a),/NOT_VERIFIED/);
  }
});
test('No optimistic precondition means no writes',()=>assert.throws(()=>classifyFounderUg(ws,{...acc,updateTime:undefined}),/NOT_VERIFIED/));
