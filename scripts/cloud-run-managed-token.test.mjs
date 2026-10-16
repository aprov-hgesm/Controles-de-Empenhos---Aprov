import test from 'node:test';
import assert from 'node:assert/strict';
import { getCloudRunManagedAccessToken } from '../lib/server/cloudRunManagedToken.mjs';

const env = (change={}) => ({
  K_SERVICE: 'emprovex-test', EMPROVEX_RUNTIME_TARGET:'cloud-run-staging',
  EMPROVEX_CLOUD_PROJECT_ID:'isolated-qa-12345',
  EMPROVEX_CLOUD_SERVICE_ACCOUNT_EMAIL:'app@isolated-qa-12345.iam.gserviceaccount.com',
  ...change
});
const makeFetch = (variant={}) => async (url, options) => {
  assert.match(url, /^http:\/\/metadata\.google\.internal\/computeMetadata\/v1\//);
  assert.equal(options.headers['Metadata-Flavor'], 'Google');
  const success = (data) => ({ok:true,status:200, text:async()=>data, json:async()=>data});
  if (variant.http403) return { ok:false,status:403 };
  if (url.endsWith('/project/project-id'))
    return success(variant.project ?? 'isolated-qa-12345');
  if (url.endsWith('/default/email'))
    return success(variant.email ?? 'app@isolated-qa-12345.iam.gserviceaccount.com');
  if (url.endsWith('/default/token')) return success(variant.token ?? {
    token_type:'Bearer', access_token:'FICTIONAL_SHORT_LIVED_OAUTH_TOKEN', expires_in:300,
    scope:'https://www.googleapis.com/auth/cloud-platform'
  });
  throw Error('unexpected URL');
};
test('managed OAuth token with synthetic metadata only', async()=>{
  const token=await getCloudRunManagedAccessToken({env:env(),fetchImpl:makeFetch()});
  assert.equal(token,'FICTIONAL_SHORT_LIVED_OAUTH_TOKEN');
});
for (const [name,change] of [
  ['missing K_SERVICE',{K_SERVICE:''}],
  ['wrong target',{EMPROVEX_RUNTIME_TARGET:'production'}],
  ['private keys',{FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'FICTIONAL'}],
  ['missing bound identity',{EMPROVEX_CLOUD_SERVICE_ACCOUNT_EMAIL:''}]
]) test(name,async()=>assert.rejects(
  getCloudRunManagedAccessToken({env:env(change),fetchImpl:makeFetch()}),/CLOUD_RUN_ADC_/));
for (const [name,variant] of [
  ['metadata project mismatch',{project:'other-project'}],
  ['metadata service-account mismatch',{email:'other@isolated-qa-12345.iam.gserviceaccount.com'}],
  ['403 access denied',{http403:true}],
  ['no OAuth access token',{token:{token_type:'Bearer',expires_in:300}}],
  ['wrong scope',{token:{token_type:'Bearer',access_token:'FICTIONAL',expires_in:300,scope:'https://www.googleapis.com/auth/monitoring.read'}}],
  ['expired token',{token:{token_type:'Bearer',access_token:'FICTIONAL',expires_in:0}}]
]) test(name,async()=>assert.rejects(
  getCloudRunManagedAccessToken({env:env(),fetchImpl:makeFetch(variant)}),/CLOUD_RUN_ADC_/));
test('network outage remains closed',async()=>assert.rejects(
  getCloudRunManagedAccessToken({env:env(),fetchImpl:async()=>{throw Error('unreachable');}}),/CLOUD_RUN_ADC_METADATA_UNAVAILABLE/));
