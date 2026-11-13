import {HospitalError,assertHospital,assertIdentifier} from '../../../../features/hospital/core/domain.mjs';
import {resolveHospitalScope} from '../core/auth.mjs';
import {HospitalMapsService} from './firestore-service.mjs';
import {HospitalDietsService} from '../diets/firestore-service.mjs';

const MAP_ACTIONS={
 'map.create':'createDraft', 'map.list':'listMaps', 'map.get':'getMap',
 'map.receipt':'receipt', 'map.versions':'listVersions', 'map.submit':'submitMap',
 'map.receive':'receiveMap', 'map.feedback':'reportDeliveryIssue', 'map.feedback.list':'listDeliveryIssues', 'map.feedback.resolve':'resolveDeliveryIssue',
 'map.close':'closeDue', 'admission.list':'listAdmissions',
 'map.productionQueue':'listKitchenQueue', 'meal.set':'setMeal',
 'meal.remove':'removeMeal', 'exception.escalate':'escalateClinicalException',
};
const DIET_ACTIONS={
 'diet.list':'listCatalog', 'diet.get':'getCatalog', 'diet.save':'saveCatalog',
 'diet.history':'catalogHistory', 'reference.record':'recordReference',
 'reference.list':'listReferences', 'reference.current':'getCurrentReference',
};
const STATUS={UNAUTHORIZED:401,FORBIDDEN:403,INVALID:400,CONFLICT:409,NOT_FOUND:404,PRECONDITION:412,UNAVAILABLE:503};

/** Server-authenticated W3 HTTP adapter; all store methods are awaitable Firestore operations. */
export function createHospitalW10Handler({store,verifyToken}){
 assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Firestore indisponível');
 const maps=new HospitalMapsService(store),diets=new HospitalDietsService(store);
 return async function handle({authorization,organizationId,operation,payload={},area}){
  try{
   assertIdentifier(organizationId,'organizationId');
   const actions=area==='maps'?MAP_ACTIONS:area==='diets'?DIET_ACTIONS:null;
   assertHospital(actions&&Object.hasOwn(actions,operation),'INVALID','Comando desconhecido');
   assertHospital(payload&&typeof payload==='object'&&!Array.isArray(payload),'INVALID','Payload inválido');
   const scope=await resolveHospitalScope({authorization,organizationId,store,verifyToken});
   const service=area==='maps'?maps:diets;
   const data=await service[actions[operation]](scope,payload);
   return {status:200,body:{ok:true,data}};
  }catch(error){
   const code=error instanceof HospitalError?error.code:'UNAVAILABLE';
   return {status:STATUS[code]??503,body:{ok:false,error:{code,message:error instanceof HospitalError?error.message:'Serviço hospitalar indisponível'}}};
  }
 };
}
