import {HospitalError,assertHospital,assertIdentifier} from '../../../../features/hospital/core/domain.mjs';
import {resolveHospitalScope} from '../core/auth.mjs';
import {HospitalMapsService} from './service.mjs';
import {HospitalDietsService} from '../diets/service.mjs';
import {HospitalQAStore} from '../core/qa-store.mjs';

const MAP_ACTIONS=Object.freeze({
 'map.create':(s,p,svc)=>svc.createDraft(s,p),
 'map.list':(s,p,svc)=>svc.listMaps(s,p),
 'map.get':(s,p,svc)=>svc.getMap(s,p),
 'map.receipt':(s,p,svc)=>svc.receipt(s,p),
 'map.versions':(s,p,svc)=>svc.listVersions(s,p),
 'map.submit':(s,p,svc)=>svc.submitMap(s,p),
 'map.close':(s,p,svc)=>svc.closeDue(s,p),
 'admission.list':(s,p,svc)=>svc.listAdmissions(s,p),
 'map.productionQueue':(s,p,svc)=>svc.listKitchenQueue(s,p),
 'meal.set':(s,p,svc)=>svc.setMeal(s,p),
 'meal.remove':(s,p,svc)=>svc.removeMeal(s,p),
 'exception.escalate':(s,p,svc)=>svc.escalateClinicalException(s,p),
});
const DIET_ACTIONS=Object.freeze({
 'diet.list':(s,p,svc)=>svc.listCatalog(s,p),
 'diet.get':(s,p,svc)=>svc.getCatalog(s,p),
 'diet.save':(s,p,svc)=>svc.saveCatalog(s,p),
 'diet.history':(s,p,svc)=>svc.catalogHistory(s,p),
 'reference.record':(s,p,svc)=>svc.recordReference(s,p),
 'reference.list':(s,p,svc)=>svc.listReferences(s,p),
 'reference.current':(s,p,svc)=>svc.getCurrentReference(s,p),
});
export function createHospitalW3Handler({store,verifyToken}){
 assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Storage QA não configurado');
 const maps=new HospitalMapsService(store),diets=new HospitalDietsService(store);
 return async function handle({authorization,organizationId,operation,payload,area}){
  try{
   assertIdentifier(organizationId,'organizationId');
   const actions=area==='maps'?MAP_ACTIONS:area==='diets'?DIET_ACTIONS:null;
   assertHospital(actions&&Object.hasOwn(actions,operation),'INVALID','Operação hospitalar desconhecida');
   const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
   assertHospital(payload&&typeof payload==='object'&&!Array.isArray(payload),'INVALID','Payload inválido');
   const data=actions[operation](scope,payload,area==='maps'?maps:diets);
   return {status:200,body:{ok:true,data}};
  }catch(error){
   const code=error instanceof HospitalError?error.code:'UNAVAILABLE';
   return {status:{UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503}[code]??503,
    body:{ok:false,error:{code,message:error instanceof HospitalError?error.message:'Serviço hospitalar indisponível'}}};
  }
 };
}
let qaStore;
export function getW3QAStore(){
 // Absolute opt-in: NO clinical datastore in production, no implicit seed, no fallback to operational Firestore.
 if(process.env.NODE_ENV==='production'||process.env.HOSPITAL_W3_QA_ENABLED!=='true'||!process.env.HOSPITAL_W3_QA_SQLITE_PATH)
  throw new HospitalError('UNAVAILABLE','Módulo hospitalar indisponível: armazenamento clínico QA não habilitado');
 if(!qaStore)qaStore=new HospitalQAStore({filename:process.env.HOSPITAL_W3_QA_SQLITE_PATH,qa:true});
 return qaStore;
}
