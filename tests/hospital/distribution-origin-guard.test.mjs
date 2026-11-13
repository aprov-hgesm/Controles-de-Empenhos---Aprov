import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distributionOriginAllowed} from '../../lib/server/hospital/distribution/origin-guard.mjs';

const local={nodeEnv:'development',firestoreQaEnabled:'1',authEmulatorEnabled:'1'};
const prod={nodeEnv:'production',firestoreQaEnabled:'1',authEmulatorEnabled:'1'};
const localUrl='http://127.0.0.1:3100/api/hospital/distribution';

test('identical origin allowed, missing Origin remains bearer-gated',()=>{
 assert.equal(distributionOriginAllowed('http://127.0.0.1:3100',localUrl,prod),true);
 assert.equal(distributionOriginAllowed(null,localUrl,prod),true);
});
test('Firebase isolated local preview accepts loopback alias only',()=>{
 assert.equal(distributionOriginAllowed('http://localhost:3100',localUrl,local),true);
 assert.equal(distributionOriginAllowed('http://127.0.0.1:3100','http://localhost:3100/api/hospital/distribution',local),true);
 assert.equal(distributionOriginAllowed('http://localhost:3100','http://127.0.0.1:3000/api/hospital/distribution',local),true);
});
test('production and other environments never relax origin',()=>{
 assert.equal(distributionOriginAllowed('http://localhost:3100',localUrl,prod),false);
 assert.equal(distributionOriginAllowed('http://localhost:3100',localUrl,{...local,firestoreQaEnabled:'0'}),false);
 assert.equal(distributionOriginAllowed('http://localhost:3100',localUrl,{...local,authEmulatorEnabled:'0'}),false);
});
test('reject arbitrary origin/port/scheme and invalid URL even in local preview',()=>{
 for(const origin of ['https://evil.example','http://localhost.evil.example:3100','http://127.0.0.1:8000',
  'https://localhost:3100','null','not-a-url','http://example.com:3100']){
  assert.equal(distributionOriginAllowed(origin,localUrl,local),false,origin);
 }
 assert.equal(distributionOriginAllowed('http://localhost:3100','https://example.com/api/hospital/distribution',local),false);
});
