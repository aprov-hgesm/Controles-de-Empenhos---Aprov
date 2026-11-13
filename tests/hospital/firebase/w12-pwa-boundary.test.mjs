import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveHospitalScope} from '../../../lib/server/hospital/core/auth.mjs';
import {HospitalReportingService} from '../../../lib/server/hospital/reporting/firestore-service.mjs';

const read=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');

test('W12 PWA private QA serves install icon endpoint but not EMPROVEX financial pages',()=>{
 const middleware=read('middleware.ts');
 const manifest=read('app/manifest.ts');
 const iconRoute=read('app/api/install-icon/[size]/route.tsx');
 assert.match(manifest,/\/api\/install-icon\/512/);
 assert.match(middleware,/path\.startsWith\('\/api\/install-icon\/'\)/);
 assert.match(middleware,/path\.startsWith\('\/api\/hospital\/'\)/);
 assert.match(middleware,/K_SERVICE==='cozinha-dietetica-qa'/);
 assert.match(middleware,/HOSPITAL_GCP_QA_PRIVATE==='1'/);
 assert.doesNotMatch(middleware,/path\.startsWith\('\/api\/billing\/'\)/);
 assert.doesNotMatch(middleware,/path\.startsWith\('\/central-empenhos\/'\)/);
 assert.doesNotMatch(iconRoute,/patient|medicalReference|recordPatient|PHI/);
 assert.doesNotMatch(manifest,/serviceWorker|indexedDB|caches\.open/);
});

test('W12 reports disclose real GCP QA provenance and never label it emulator',async()=>{
 const org='qa_source_org';
 const store={
  transport:'gcp',
  findMembership:async(o,uid)=>o===org&&uid==='synthetic_uid'?{
   id:'membership_qa',uid,organizationId:org,ug:'UG_QA',active:true,
   roles:['KITCHEN'],unitIds:['UTI']
  }:null,
  findOrganization:async o=>o===org?{id:org,ug:'UG_QA',active:true}:null,
  list:async()=>[],
  listMapVersions:async()=>[],
  events:async()=>[]
 };
 const scope=await resolveHospitalScope({authorization:'Bearer synthetic_uid',organizationId:org,
  store,verifyToken:async()=>({uid:'synthetic_uid'})});
 const report=await new HospitalReportingService(store).query(scope,{view:'production',
  filters:{from:'2026-11-18',to:'2026-11-18',unitId:'UTI'}});
 assert.equal(report.source,'W12_FIRESTORE_GCP_HOSPITAL_QA');
 assert.equal(report.total,0);
 assert.equal(report.partial,false);
 await assert.rejects(new HospitalReportingService(store).query(scope,{view:'production',
  filters:{from:'2026-11-18',to:'2026-11-18',unitId:'UTI',ug:'UG_WRONG'}}),{code:'FORBIDDEN'});
});
