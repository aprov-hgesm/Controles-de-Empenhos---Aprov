#!/usr/bin/env node
// W12 local-only, synthetic preview setup. Never contacts a real Firebase project.
import {HospitalFirestoreStore} from '../lib/server/hospital/firebase/firestore-store.mjs';
import {resolveHospitalScope} from '../lib/server/hospital/core/auth.mjs';
import {HospitalPatientsService} from '../lib/server/hospital/patients/firestore-service.mjs';
import {HospitalDietsService} from '../lib/server/hospital/diets/firestore-service.mjs';
import {HospitalMapsService} from '../lib/server/hospital/maps/firestore-service.mjs';

const PROJECT='demo-cozinha-dietetica';
const ORG='qa_hgesm_preview';
const PASSWORD='DemoLocal!2026'; // Only the local Auth Emulator; not a real account.
const AUTH='http://127.0.0.1:9099';
const units=['UTI','UPI','PAM','ONCOLOGIA','BLOCO'];
const people=[
  ...units.map(unit=>({key:unit,email:'qa-'+unit.toLowerCase()+'@example.test',roles:['UNIT'],unitIds:[unit]})),
  {key:'COZINHA',email:'qa-cozinha@example.test',roles:['KITCHEN'],unitIds:units},
  {key:'NUTRICAO',email:'qa-nutricao@example.test',roles:['NUTRITION'],unitIds:units},
  {key:'ADMIN',email:'qa-admin@example.test',roles:['HOSPITAL_ADMIN'],unitIds:units},
];

function fail(message){throw Error('PREVIEW_LOCAL_BLOQUEADO: '+message)}
function assertLocal(){
  if(process.env.NODE_ENV==='production'||process.env.HOSPITAL_GCP_QA_ENABLED==='1')
    fail('ambiente de produção/GCP não permitido');
  if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'
     ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'
     ||process.env.HOSPITAL_FIRESTORE_QA_ENABLED!=='1'
     ||process.env.HOSPITAL_QA_ORGANIZATION_ID!==ORG
     ||process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_PROJECT_ID!==PROJECT
     ||process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR!=='1')
    fail('somente emuladores locais demo-* com flags de QA explícitas');
}
async function emulatorAuth(path,body){
  const response=await fetch(AUTH+'/identitytoolkit.googleapis.com/v1/'+path+'?key=preview-local-only',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
    signal:AbortSignal.timeout(10000)
  });
  const payload=await response.json();
  if(response.ok)return payload;
  const code=payload?.error?.message??String(response.status);
  const error=new Error(code);error.code=code;throw error;
}
async function ensureUser(person){
  try{
    const data=await emulatorAuth('accounts:signUp',{email:person.email,password:PASSWORD,returnSecureToken:true});
    if(typeof data.localId!=='string'||!data.localId)fail('UID vazio em Auth Emulator');
    return {...person,uid:data.localId};
  }catch(error){
    if(!String(error.code).includes('EMAIL_EXISTS'))throw error;
    const data=await emulatorAuth('accounts:signInWithPassword',{
      email:person.email,password:PASSWORD,returnSecureToken:true
    });
    return {...person,uid:data.localId};
  }
}
const localDate=offset=>new Intl.DateTimeFormat('en-CA',{
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date(Date.now()+offset*86400000));
async function main(){
  assertLocal();
  const store=new HospitalFirestoreStore();
  try{
    if(!await store.findOrganization(ORG))await store.seedOrganization({
      id:ORG,ug:'UG_PREVIEW_000',active:true
    });
    const users=[];
    for(const profile of people){
      const person=await ensureUser(profile);
      users.push(person);
      if(!await store.findMembership(ORG,person.uid))await store.seedMembership({
        id:'membership_'+person.uid,uid:person.uid,organizationId:ORG,
        ug:'UG_PREVIEW_000',active:true,roles:person.roles,unitIds:person.unitIds
      });
    }
    for(const unit of units){
      const existing=(await store.listOrgUnits(ORG)).some(row=>row.id===unit);
      if(!existing)await store.transaction(async db=>{
        const row=await db.put(ORG,'unit',unit,{
          id:unit,organizationId:ORG,unitId:unit,code:unit,
          name:unit==='ONCOLOGIA'?'Oncologia':unit==='BLOCO'?'Bloco Cirúrgico':unit,
          type:'CARE',active:true
        },0);
        await db.saveOrgUnit(ORG,row);
      });
    }

    // One fictional admission and submitted map to make the preview useful.
    const unit=users.find(p=>p.key==='UTI');
    const admin=users.find(p=>p.key==='ADMIN');
    const scope=person=>resolveHospitalScope({
      authorization:'Bearer '+person.uid,organizationId:ORG,store,
      verifyToken:async()=>({uid:person.uid})
    });
    const nurseScope=await scope(unit),adminScope=await scope(admin);
    const patients=new HospitalPatientsService(store);
    const diets=new HospitalDietsService(store);
    const maps=new HospitalMapsService(store);
    const found=await patients.search(nurseScope,{unitId:'UTI',q:'PREVIEW_UTI_001',status:'ALL'});
    const entry=found.items.find(row=>row.patient.referenceCode==='PREVIEW_UTI_001');
    if(!entry){
      const bed=await patients.saveBed(adminScope,{unitId:'UTI',
        bedId:'PREVIEW_BED_01',label:'Leito fictício 01'});
      const patient=await patients.registerPatient(nurseScope,{
        unitId:'UTI',referenceCode:'PREVIEW_UTI_001',
        displayName:'Paciente Totalmente Fictício'
      });
      const admission=await patients.admit(nurseScope,{
        patientId:patient.id,unitId:'UTI',bedId:bed.id
      });
      const diet=await diets.saveCatalog(adminScope,{
        catalogItemId:'DIET_PREVIEW',code:'DIET_PREVIEW',
        label:'Dieta demonstrativa',type:'ORAL',consistency:'NORMAL',route:'ORAL',
        restrictionCodes:[],allergenCodes:[],status:'ACTIVE',expectedRevision:0
      });
      const ref=(await diets.recordReference(nurseScope,{
        unitId:'UTI',admissionId:admission.id,referenceId:'REF_PREVIEW_UTI',
        catalogItemId:diet.id,sourceRef:'PRESCRICAO_FICTICIA',
        sourceVersion:'1',prescriberAsRecorded:'Profissional Fictício',
        prescribedAt:new Date().toISOString(),fasting:false,
        allergyCodes:[],restrictionCodes:[]
      })).reference;
      const draft=await maps.createDraft(nurseScope,{
        unitId:'UTI',localDate:localDate(2),cycleId:'10'
      });
      const inserted=await maps.setMeal(nurseScope,{
        mapId:draft.id,admissionId:admission.id,mealType:'PRIMARY',
        medicalReferenceId:ref.id,dietCode:diet.id,
        expectedMapRevision:draft.revision,idempotencyKey:'preview_local_meal_1'
      });
      await maps.submitMap(nurseScope,{
        mapId:draft.id,expectedRevision:inserted.map.revision,
        idempotencyKey:'preview_local_submit_1'
      });
    }
    console.log('\n=== PREVIA LOCAL W12 (SOMENTE DADOS FICTICIOS) ===');
    for(const person of users)console.log(person.key.padEnd(12),person.email);
    console.log('Senha EXCLUSIVA DO EMULADOR:',PASSWORD);
    console.log('Projeto:',PROJECT,'| organizacao:',ORG);
  }finally{store.close()}
}
main().catch(error=>{console.error('PREVIEW_LOCAL_SEED_ERROR:',error);process.exitCode=1});
