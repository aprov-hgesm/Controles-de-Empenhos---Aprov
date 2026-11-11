import {assertHospital,assertDate,assertIdentifier,HospitalError} from '../../../../features/hospital/core/domain.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';

const TYPES=new Set(['ORAL','ENTERAL','SUPPLEMENT','OTHER']);
const CONSISTENCIES=new Set(['NORMAL','SOFT','PUREED','LIQUID','THICKENED','NOT_APPLICABLE']);
const STATUS=new Set(['ACTIVE','INACTIVE']);
function words(value,field,max=200){assertHospital(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,'INVALID',`${field} obrigatório ou inválido`);return value.trim()}
function codes(value,field){assertHospital(Array.isArray(value)&&value.length<=80&&value.every(x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_:-]{0,63}$/.test(x)),'INVALID',`${field} inválido`);return [...new Set(value)]}
function validTimestamp(value,field){assertHospital(typeof value==='string'&&!Number.isNaN(Date.parse(value)),'INVALID',`${field} inválido`);return value}
function requiredUnit(scope,unitId,permission){requireHospitalPermission(scope,permission,unitId);return unitId}
function catalogRead(scope,unitId){
 if(scope.roles?.includes('HOSPITAL_ADMIN'))requireHospitalPermission(scope,'hospital:manage');
 else requiredUnit(scope,unitId,'admission:read');
}
function assertCatalog(spec){
 assertIdentifier(spec.catalogItemId,'catalogItemId');assertIdentifier(spec.code,'code');
 const label=words(spec.label,'Nome',160);
 assertHospital(TYPES.has(spec.type),'INVALID','Tipo de dieta inválido');
 const consistency=spec.consistency??'NOT_APPLICABLE';
 assertHospital(CONSISTENCIES.has(consistency),'INVALID','Consistência inválida');
 const route=words(spec.route??'ORAL','Via',80);
 const device=spec.device==null?null:words(spec.device,'Dispositivo',80);
 if(spec.type==='ORAL')assertHospital(!device||device==='NONE','INVALID','Via/dispositivo incompatível');
 const restrictionCodes=codes(spec.restrictionCodes??[],'Restrições');
 const allergenCodes=codes(spec.allergenCodes??[],'Alérgenos');
 const status=spec.status??'ACTIVE';assertHospital(STATUS.has(status),'INVALID','Status inválido');
 const volumeMl=spec.volumeMl??null;
 assertHospital(volumeMl===null||(Number.isFinite(volumeMl)&&volumeMl>0&&volumeMl<=10000),'INVALID','Volume inválido');
 const unit=words(spec.unit??(volumeMl===null?'portion':'mL'),'Unidade',30);
 const preparations=spec.preparations??[];
 assertHospital(Array.isArray(preparations)&&preparations.length<=50&&preparations.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=160),'INVALID','Preparações inválidas');
 return {code:spec.code,label,type:spec.type,consistency,route,device,restrictionCodes,allergenCodes,active:status==='ACTIVE',status,volumeMl,unit,preparations:preparations.map(x=>x.trim())};
}
/** Never grant scope from HTTP claims. HospitalScope must originate from W0 token+membership verification. */
export class HospitalDietsService{
 constructor(store){assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Storage hospitalar indisponível');this.store=store}
 async listCatalog(scope,{unitId,includeInactive=false}={}){
  catalogRead(scope,unitId);
  return (await this.store.list(scope.organizationId,'catalog_diet','hospital_catalog')).filter(x=>includeInactive||x.active);
 }
 async getCatalog(scope,{unitId,catalogItemId}){
  catalogRead(scope,unitId);assertIdentifier(catalogItemId);
  const item=await this.store.get(scope.organizationId,'catalog_diet',catalogItemId);
  assertHospital(item&&item.unitId==='hospital_catalog','NOT_FOUND','Dieta não encontrada');return item;
 }
 async saveCatalog(scope,spec){
  requireHospitalPermission(scope,'hospital:manage');
  const input=assertCatalog(spec);
  return this.store.transaction(async db=>{
   const prev=await db.get(scope.organizationId,'catalog_diet',spec.catalogItemId);
   assertHospital(!prev||prev.unitId==='hospital_catalog','CONFLICT','Catálogo fora do escopo');
   if(prev)assertHospital(Number.isInteger(spec.expectedRevision)&&spec.expectedRevision===prev.revision,'CONFLICT','Revisão do catálogo obsoleta');
   else assertHospital(spec.expectedRevision==null||spec.expectedRevision===0,'CONFLICT','Item não cadastrado');
   const duplicate=(await db.list(scope.organizationId,'catalog_diet','hospital_catalog')).find(x=>x.code===input.code&&x.id!==spec.catalogItemId);
   assertHospital(!duplicate,'CONFLICT','Código já utilizado');
   const row=await db.put(scope.organizationId,'catalog_diet','hospital_catalog',{id:spec.catalogItemId,organizationId:scope.organizationId,unitId:'hospital_catalog',...input,updatedByUid:scope.uid,updatedAt:db.now()},prev?.revision);
   await db.appendEvent(scope.organizationId,'catalog_diet',row.id,'dietCatalog.updated',scope.uid,{before:prev??null,after:row});
   const criticalChange=!!prev&&(prev.active!==row.active
    ||JSON.stringify(prev.restrictionCodes??[])!==JSON.stringify(row.restrictionCodes??[])
    ||JSON.stringify(prev.allergenCodes??[])!==JSON.stringify(row.allergenCodes??[])
    ||prev.route!==row.route||prev.consistency!==row.consistency||prev.device!==row.device);
   if(criticalChange){
    // Inactivation or changed safety/route requirements invalidate existing in-flight preparations.
    const affectedMaps=new Set();
    // Catalog administration only scans units explicitly within this hospital membership;
    // release paths independently compare the catalog revision to fail closed.
    for(const targetUnit of scope.unitIds) for(const meal of await db.list(scope.organizationId,'meal',targetUnit)){
     if(meal.dietCode!==row.id||['DELIVERED','CANCELLED'].includes(meal.status))continue;
     if(meal.status!=='SAFETY_BLOCKED')
      await db.put(scope.organizationId,'meal',meal.unitId,{...meal,status:'SAFETY_BLOCKED',requiresRecheck:true,suspensionReason:'DIET_CATALOG_CHANGED'},meal.revision);
     await db.appendEvent(scope.organizationId,'meal',meal.id,'meal.suspended',scope.uid,{reason:'DIET_CATALOG_CHANGED',catalogItemId:row.id});
     affectedMaps.add(meal.mapId);
    }
    for(const mapId of affectedMaps){
     const map=await db.get(scope.organizationId,'map',mapId);
     if(!map||map.status==='DRAFT')continue;
     const updated=await db.put(scope.organizationId,'map',map.unitId,{...map,updatedAt:db.now()},map.revision);
     const version=(await db.listMapVersions(scope.organizationId,mapId)).length+1;
     await db.saveMapVersion(scope.organizationId,mapId,version,'AMENDMENT',
      {map:updated,meals:(await db.list(scope.organizationId,'meal',map.unitId)).filter(m=>m.mapId===mapId)},
      'Catálogo institucional alterado; reconferência clínica pendente',scope.uid);
     await db.appendEvent(scope.organizationId,'map',mapId,'map.amended',scope.uid,{version,reason:'DIET_CATALOG_CHANGED'});
    }
   }
   return row;
  });
 }
 async catalogHistory(scope,{catalogItemId}){
  requireHospitalPermission(scope,'hospital:manage');assertIdentifier(catalogItemId);
  const item=await this.store.get(scope.organizationId,'catalog_diet',catalogItemId);
  assertHospital(item&&item.unitId==='hospital_catalog','NOT_FOUND','Item não encontrado');
  return await this.store.events(scope.organizationId,'catalog_diet',catalogItemId);
 }
 async listReferences(scope,{unitId,admissionId}){
  requiredUnit(scope,unitId,'admission:read');assertIdentifier(admissionId);
  const adm=await this.store.get(scope.organizationId,'admission',admissionId);
  assertHospital(adm&&adm.unitId===unitId,'NOT_FOUND','Internação não encontrada');
  return (await this.store.list(scope.organizationId,'medical_reference',unitId)).filter(x=>x.admissionId===admissionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 }
 async getCurrentReference(scope,{unitId,admissionId}){
  requiredUnit(scope,unitId,'admission:read');assertIdentifier(admissionId);
  const adm=await this.store.get(scope.organizationId,'admission',admissionId);
  assertHospital(adm&&adm.unitId===unitId,'NOT_FOUND','Internação não encontrada');
  return adm.medicalReferenceId?await this.store.get(scope.organizationId,'medical_reference',adm.medicalReferenceId):null;
 }
 /**
  * Operational transcription of an EXISTING medical prescription; never creates clinical orders.
  * One immutable reference record per source version, linked to an active admission.
  * Revisions that invalidate in-flight meals atomically suspend them, never mark delivered.
  */
 async recordReference(scope,entry){
  const {unitId,admissionId,referenceId,catalogItemId}=entry;
  requiredUnit(scope,unitId,'admission:write');
  for(const value of [admissionId,referenceId,catalogItemId])assertIdentifier(value);
  const sourceRef=words(entry.sourceRef,'Identificador da prescrição',200);
  const sourceVersion=words(entry.sourceVersion,'Versão de origem',80);
  const prescriberAsRecorded=words(entry.prescriberAsRecorded,'Médico identificado na origem',200);
  const prescribedAt=validTimestamp(entry.prescribedAt,'Data da prescrição');
  const effectiveAt=entry.effectiveAt==null?null:validTimestamp(entry.effectiveAt,'Vigência informada');
  const restrictionCodes=codes(entry.restrictionCodes??[],'Restrições clínicas');
  const allergyCodes=codes(entry.allergyCodes??[],'Alergias');
  assertHospital(typeof entry.fasting==='boolean','INVALID','Jejum deve constar conforme prescrição');
  return this.store.transaction(async db=>{
   const admission=await db.get(scope.organizationId,'admission',admissionId);
   assertHospital(admission&&admission.unitId===unitId&&admission.status==='ACTIVE','NOT_FOUND','Internação ativa não encontrada na unidade');
   const catalog=await db.get(scope.organizationId,'catalog_diet',catalogItemId);
   assertHospital(catalog&&catalog.unitId==='hospital_catalog'&&catalog.active,'PRECONDITION','Dieta autorizada não encontrada');
   const previous=await db.get(scope.organizationId,'medical_reference',referenceId);
   assertHospital(!previous,'CONFLICT','Referência já registrada; novo registro exige novo ID e versão');
   const used=(await db.list(scope.organizationId,'medical_reference',unitId)).some(x=>x.admissionId===admissionId&&x.sourceRef===sourceRef&&x.sourceVersion===sourceVersion);
   assertHospital(!used,'CONFLICT','Esta versão da prescrição já foi transcrita');
   const createdAt=db.now();
   const row=await db.put(scope.organizationId,'medical_reference',unitId,{id:referenceId,organizationId:scope.organizationId,unitId,admissionId,catalogItemId,sourceRef,sourceVersion,prescriberAsRecorded,prescribedAt,effectiveAt,enteredByUid:scope.uid,restrictionCodes,allergyCodes,fasting:entry.fasting,createdAt});
   await db.put(scope.organizationId,'admission',unitId,{...admission,medicalReferenceId:referenceId,fasting:entry.fasting,allergyCodes},admission.revision);
   await db.appendEvent(scope.organizationId,'admission',admissionId,'dietReference.updated',scope.uid,{referenceId,previousReferenceId:admission.medicalReferenceId??null,catalogItemId,sourceVersion},effectiveAt);
   // Any current meal based on an older prescription must be rechecked by assistance/kitchen.
   const rows=await db.list(scope.organizationId,'meal',unitId);
   const affectedMaps=new Set();
   for(const meal of rows){
    if(meal.admissionId!==admissionId||['CANCELLED','DELIVERED'].includes(meal.status))continue;
    if(meal.medicalReferenceId===referenceId)continue;
    if(meal.status!=='SAFETY_BLOCKED'){
     await db.put(scope.organizationId,'meal',meal.unitId,{...meal,status:'SAFETY_BLOCKED',suspensionReason:'DIET_REFERENCE_CHANGED',requiresRecheck:true},meal.revision);
    }
    await db.appendEvent(scope.organizationId,'meal',meal.id,'meal.suspended',scope.uid,{reason:'DIET_REFERENCE_CHANGED',referenceId});
    affectedMaps.add(meal.mapId);
   }
   for(const mapId of affectedMaps){
    const map=await db.get(scope.organizationId,'map',mapId);
    if(!map||map.status==='DRAFT')continue;
    const updatedMap=await db.put(scope.organizationId,'map',map.unitId,{...map,updatedAt:db.now()},map.revision);
    const version=(await db.listMapVersions(scope.organizationId,mapId)).length+1;
    const meals=(await db.list(scope.organizationId,'meal',map.unitId)).filter(m=>m.mapId===map.id);
    await db.saveMapVersion(scope.organizationId,map.id,version,'AMENDMENT',{map:updatedMap,meals},'Prescrição médica alterada; reconferência pendente',scope.uid);
    await db.appendEvent(scope.organizationId,'map',map.id,'map.amended',scope.uid,{version,reason:'DIET_REFERENCE_CHANGED'});
   }
   return {reference:row,affectedMaps:[...affectedMaps],requiresKitchenRecheck:affectedMaps.size>0};
  });
 }
}
