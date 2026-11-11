import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyHospitalFirebaseIdToken} from '../../../lib/server/hospital/firebase/verify-id-token.mjs';

const valid = {iss:'https://securetoken.google.com/cozinha-dietetica',aud:'cozinha-dietetica',sub:'test-user',auth_time:1762800000};
const fakeJWT = async () => ({payload:{...valid}});
function lookup(user={localId:'test-user',validSince:'1762790000',disabled:false}) {
  return async (url,options) => {
    assert.match(url,/identitytoolkit.googleapis.com\/v1\/accounts:lookup/);
    assert.deepEqual(JSON.parse(options.body),{idToken:'synthetic-firebase-token-xxxxxxxxxxx'});
    assert.equal(options.cache,'no-store');
    return {ok:true,json:async()=>({users:[user]})};
  };
}
test('hospital Firebase token is tied to issuer, project and live validSince',async()=>{
  process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY='test-public-api-key';
  const u=await verifyHospitalFirebaseIdToken('synthetic-firebase-token-xxxxxxxxxxx',{verifyJwt:fakeJWT,fetchAccount:lookup()});
  assert.deepEqual(u,{uid:'test-user'});
  await assert.rejects(()=>verifyHospitalFirebaseIdToken('synthetic-firebase-token-xxxxxxxxxxx',{
    verifyJwt:async()=>({payload:{...valid,aud:'gen-lang-client-0982077967'}}),fetchAccount:lookup()}),/CLAIMS/);
  await assert.rejects(()=>verifyHospitalFirebaseIdToken('synthetic-firebase-token-xxxxxxxxxxx',{
    verifyJwt:async()=>({payload:{...valid,iss:'https://securetoken.google.com/not-hospital'}}),fetchAccount:lookup()}),/CLAIMS/);
});
test('disabled, revoked and missing account are always rejected',async()=>{
  process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY='test-public-api-key';
  for(const user of [
    {localId:'test-user',validSince:'1762790000',disabled:true},
    {localId:'test-user',validSince:'1762900000',disabled:false},
    {localId:'other-user',validSince:'1762790000',disabled:false},
    {localId:'test-user',disabled:false},
  ]){
    await assert.rejects(()=>verifyHospitalFirebaseIdToken('synthetic-firebase-token-xxxxxxxxxxx',{
      verifyJwt:fakeJWT,fetchAccount:lookup(user)}),/REVOKED/);
  }
});
test('offline lookup and absent configuration do not downgrade verification',async()=>{
  process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY='test-public-api-key';
  await assert.rejects(()=>verifyHospitalFirebaseIdToken('synthetic-firebase-token-xxxxxxxxxxx',{
    verifyJwt:fakeJWT,fetchAccount:async()=>({ok:false})}),/FAILED/);
  delete process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY;
  await assert.rejects(()=>verifyHospitalFirebaseIdToken('synthetic-firebase-token-xxxxxxxxxxx',{
    verifyJwt:fakeJWT,fetchAccount:lookup()}),/UNCONFIGURED/);
});
