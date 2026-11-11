import {createHash,randomUUID} from 'node:crypto';
import {HospitalCoreService} from '../core/service.mjs';
import {requireHospitalPermission} from '../core/auth.mjs';
import {assertHospital,assertIdentifier,assertMealReleaseSafe,classifyMealTiming,nextMealStatus} from '../../../../features/hospital/core/domain.mjs';

/** W5, server-only: shares W0's QA SQLite transaction and immutable journal, never client state. */
const kinds=new Set(['assembly.start','assembly.complete','assembly.check','batch.dispatch','batch.receive','meal.deliver','meal.return','meal.cancel','route.flag']);
const text=(value,name,max=250)=>{assertHospital(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,'INVALID',name+' obrigatório');return value.trim()};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const recordId=mealId=>'dist_'+createHash('sha256').update(mealId).digest('hex').slice(0,26);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=xs=>Array.isArray(xs)&&xs.length>0&&xs.length<=100&&xs.every(x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$/.test(x))&&new Set(xs).size===xs.length;
const transitionEvent={DISPATCHED:'meal.dispatched',RECEIVED_BY_UNIT:'meal.received',DELIVERED:'meal.delivered',SUSPENDED:'meal.suspended',CANCELLED:'meal.suspended'};

export class DistributionService {
  constructor(store){assertHospital(store&&typeof store.transaction==='function','UNAVAILABLE','Hospital QA storage indisponível');this.store=store;this.core=new HospitalCoreService(store)}
  _meal(scope,mealId,unitId,permission='meal:distribution'){assertIdentifier(mealId);requireHospitalPermission(scope,permission,unitId);return this.core.get(scope,'meal',mealId,unitId)}
  _job(scope,meal){const job=this.store.get(scope.organizationId,'label',recordId(meal.id));assertHospital(job&&job.mealId===meal.id&&job.unitId===meal.unitId,'PRECONDITION','Montagem não iniciada');return job}
  _clinical(scope,meal,{requireReady=false}={}){
    const db=this.store,org=scope.organizationId;
    const admission=db.get(org,'admission',meal.admissionId);
    assertHospital(admission&&admission.status==='ACTIVE','PRECONDITION','Internação não ativa');
    assertHospital(admission.unitId===meal.unitId,'PRECONDITION','Transferência confirmada: reconciliar destino antes de entregar');
    const medical=db.get(org,'medical_reference',meal.medicalReferenceId);
    assertHospital(medical&&medical.unitId===admission.unitId&&medical.admissionId===admission.id&&admission.medicalReferenceId===medical.id&&medical.catalogItemId===meal.dietCode,'PRECONDITION','Dieta/prescrição vigente divergente');
    const catalog=db.get(org,'catalog_diet',meal.dietCode);
    assertHospital(catalog&&catalog.active===true,'PRECONDITION','Dieta removida do catálogo');
    assertMealReleaseSafe({fasting:admission.fasting,allergyCodes:admission.allergyCodes,dietRestrictionCodes:[...new Set([...(meal.dietRestrictionCodes||[]),...(catalog.restrictionCodes||[])])]});
    if(requireReady)assertHospital(meal.status==='READY','PRECONDITION','Produção não está concluída (READY)');
    return {admission,medical,catalog};
  }
  _record(scope,meal,job,next,event,detail={}){
    const db=this.store;
    const updated=db.put(scope.organizationId,'label',meal.unitId,{...job,state:next,updatedAt:db.now(),updatedBy:scope.uid},job.revision);
    db.appendEvent(scope.organizationId,'meal',meal.id,event,scope.uid,{distributionState:next,unitId:meal.unitId,...detail});
    return updated;
  }
  _transition(scope,meal,next,job,distributionState,detail={}){
    nextMealStatus(meal.status,next);
    const db=this.store;
    const updated=db.put(scope.organizationId,'meal',meal.unitId,{...meal,status:next},meal.revision);
    db.appendEvent(scope.organizationId,'meal',meal.id,transitionEvent[next],scope.uid,{from:meal.status,to:next,distribution:true,...detail});
    const deliveryEvent=db.put(scope.organizationId,'delivery_event',meal.unitId,{
      id:'delivery_'+randomUUID(),organizationId:scope.organizationId,unitId:meal.unitId,
      mealId:meal.id,type:next,actorUid:scope.uid,occurredAt:db.now(),effectiveAt:null,
      destinationUnitId:job.destinationUnitId
    });
    const saved=db.put(scope.organizationId,'label',meal.unitId,{...job,state:distributionState,updatedAt:db.now(),updatedBy:scope.uid,lastDeliveryEventId:deliveryEvent.id},job.revision);
    return {meal:updated,job:saved,event:deliveryEvent};
  }
  _validateSnapshot(scope,meal,job){
    const clinical=this._clinical(scope,meal);
    assertHospital(job.medicalReferenceId===meal.medicalReferenceId&&job.dietCode===meal.dietCode,'PRECONDITION','Pedido alterado após montagem: reconferir');
    assertHospital(job.destinationUnitId===clinical.admission.unitId&&job.destinationBedId===(clinical.admission.bedId||null),'PRECONDITION','Localização alterada: reconciliar rota');
    assertHospital(!clinical.admission.allergyCodes.some(code=>job.ingredientCodes.includes(code)),'PRECONDITION','Ingrediente incompatível com alergia');
    assertHospital(job.preparedDietCode===meal.dietCode,'PRECONDITION','Preparação não corresponde à dieta vigente');
    return clinical;
  }
  _checkBatch(scope,payload){
    assertHospital(uniq(payload.mealIds),'INVALID','Lote deve conter IDs distintos');
    assertHospital(payload.mealIds.length<=50,'INVALID','Lote excede o limite de 50 refeições');
    if(payload.batchId){
      assertIdentifier(payload.batchId,'batchId');
      const batch=this.store.get(scope.organizationId,'production_batch',payload.batchId);
      assertHospital(batch&&batch.organizationId===scope.organizationId&&batch.status==='COMPLETE'&&payload.mealIds.every(id=>batch.mealIds?.includes(id)),'PRECONDITION','Lote de produção não concluído ou sem correspondência');
    }
  }
  command(scope,operation,payload={}){
    assertHospital(kinds.has(operation),'INVALID','Comando de distribuição inválido');
    assertHospital(payload&&typeof payload==='object'&&!Array.isArray(payload),'INVALID','Payload inválido');
    const {idempotencyKey,...p}=payload;
    assertIdentifier(idempotencyKey,'idempotencyKey');
    assertIdentifier(p.unitId,'unitId');
    const permission=operation==='batch.receive'&&scope?.roles?.includes('UNIT')?'meal:write':'meal:distribution';
    requireHospitalPermission(scope,permission,p.unitId);
    const org=scope.organizationId;
    return this.store.transaction(db=>db.idempotent(org,'w5.'+operation,idempotencyKey,hash({uid:scope.uid,p}),()=>{
      if(operation==='batch.dispatch'||operation==='batch.receive'){
        this._checkBatch(scope,p);
        const checked=p.mealIds.map(id=>{const meal=this._meal(scope,id,p.unitId,permission),job=this._job(scope,meal);
          assertHospital(operation==='batch.dispatch'?(job.state==='CHECKED'&&meal.status==='READY'):(job.state==='DISPATCHED'&&meal.status==='DISPATCHED'),'PRECONDITION','Estado do lote incompatível');
          this._validateSnapshot(scope,meal,job);
          return {meal,job};
        });
        return checked.map(({meal,job})=>this._transition(scope,meal,operation==='batch.dispatch'?'DISPATCHED':'RECEIVED_BY_UNIT',job,operation==='batch.dispatch'?'DISPATCHED':'RECEIVED',p.batchId?{batchId:p.batchId}:{}));
      }
      const meal=this._meal(scope,p.mealId,p.unitId);
      if(operation==='assembly.start'){
        this._clinical(scope,meal,{requireReady:true});
        const map=this.store.get(org,'map',meal.mapId);
        assertHospital(map&&map.status!=='DRAFT','PRECONDITION','Mapa não foi enviado');
        assertHospital(!this.store.get(org,'label',recordId(meal.id)),'CONFLICT','Montagem já iniciada');
        const admission=this.store.get(org,'admission',meal.admissionId);
        const patient=this.store.get(org,'patient',admission.patientId);
        assertHospital(patient&&patient.organizationId===org&&patient.referenceCode,'PRECONDITION','Identificador de paciente indisponível');
        const job=db.put(org,'label',meal.unitId,{
          id:recordId(meal.id),organizationId:org,unitId:meal.unitId,mealId:meal.id,
          state:'ASSEMBLING',destinationUnitId:admission.unitId,destinationBedId:admission.bedId||null,
          dietCode:meal.dietCode,medicalReferenceId:meal.medicalReferenceId,orderRevision:meal.revision,
          labelCode:'meal_'+randomUUID(),createdAt:db.now(),createdBy:scope.uid,updatedAt:db.now(),
          ingredientCodes:[],preparedDietCode:null,checkedAt:null,checkedBy:null
        });
        db.appendEvent(org,'meal',meal.id,'meal.assembly.started',scope.uid,{unitId:meal.unitId});
        return job;
      }
      const job=this._job(scope,meal);
      if(operation==='assembly.complete'){
        assertHospital(job.state==='ASSEMBLING'&&meal.status==='READY','PRECONDITION','Montagem não iniciada ou refeição sem preparo');
        const {admission}=this._clinical(scope,meal,{requireReady:true});
        text(p.preparedDietCode,'Dieta preparada');
        assertHospital(p.preparedDietCode===meal.dietCode,'PRECONDITION','Dieta preparada incompatível');
        assertHospital(uniq(p.ingredientCodes),'INVALID','Ingredientes/restrições da preparação devem ser informados');
        assertHospital(!admission.allergyCodes.some(code=>p.ingredientCodes.includes(code)),'PRECONDITION','Preparação contém alérgeno registrado');
        return this._record(scope,meal,{...job,preparedDietCode:p.preparedDietCode,ingredientCodes:p.ingredientCodes},'ASSEMBLED','meal.assembly.completed');
      }
      if(operation==='assembly.check'){
        assertHospital(job.state==='ASSEMBLED'&&meal.status==='READY','PRECONDITION','Montagem/preparo ainda não concluídos');
        this._validateSnapshot(scope,meal,job);
        return this._record(scope,meal,{...job,checkedAt:db.now(),checkedBy:scope.uid},'CHECKED','meal.assembly.checked');
      }
      if(operation==='meal.deliver'){
        assertHospital(job.state==='RECEIVED'&&meal.status==='RECEIVED_BY_UNIT','PRECONDITION','Refeição não recebida pela unidade');
        const {admission}=this._validateSnapshot(scope,meal,job);
        const patient=db.get(org,'patient',admission.patientId);
        assertHospital(patient&&patient.referenceCode&&patient.displayName,'PRECONDITION','Dois identificadores institucionais indisponíveis');
        assertHospital(text(p.patientReferenceCode,'Identificador 1',150)===patient.referenceCode&&text(p.patientDisplayName,'Identificador 2',200).toLocaleLowerCase('pt-BR')===patient.displayName.trim().toLocaleLowerCase('pt-BR'),'PRECONDITION','Identificação positiva não conferida');
        assertHospital(p.identityMethod==='MANUAL'||p.identityMethod==='SCANNER','INVALID','Método de identificação inválido');
        return this._transition(scope,meal,'DELIVERED',job,'DELIVERED',{identityMethod:p.identityMethod,identifiersChecked:2});
      }
      if(operation==='meal.return'||operation==='meal.cancel'){
        const reason=text(p.reason,'Motivo',500);
        assertHospital(job.state!=='DELIVERED'&&!['DELIVERED','CANCELLED'].includes(meal.status),'PRECONDITION','Entrega concluída não pode ser estornada automaticamente');
        const isReturn=operation==='meal.return';
        assertHospital(isReturn?['DISPATCHED','RECEIVED'].includes(job.state):['ASSEMBLING','ASSEMBLED','CHECKED'].includes(job.state),'PRECONDITION','Operação incompatível com estado');
        const next=isReturn?'SUSPENDED':'CANCELLED';
        return this._transition(scope,meal,next,job,isReturn?'RETURNED':'CANCELLED',{reason});
      }
      if(operation==='route.flag'){
        const admission=db.get(org,'admission',meal.admissionId);
        assertHospital(admission&&admission.unitId!==meal.unitId,'PRECONDITION','Não há transferência confirmada');
        text(p.reason,'Motivo da reconciliação',500);
        return this._record(scope,meal,{...job,routeToUnitId:admission.unitId,routeToBedId:admission.bedId||null},'ROUTE_RECONCILIATION_REQUIRED','meal.route.reconciliation_required',{reason:p.reason});
      }
      throw Error('unreachable');
    }));
  }
  status(scope,{unitId,mealId}){
    const meal=this._meal(scope,mealId,unitId);
    const job=this.store.get(scope.organizationId,'label',recordId(meal.id));
    const admission=this.store.get(scope.organizationId,'admission',meal.admissionId);
    const routeMismatch=!!admission&&admission.unitId!==meal.unitId;
    const timing=classifyMealTiming({cycleId:meal.cycleId,localDate:meal.localDate,at:this.store.now(),mealType:meal.mealType});
    return {mealId:meal.id,mealStatus:meal.status,distributionState:job?.state||'NOT_STARTED',jobRevision:job?.revision||null,
      destinationUnitId:routeMismatch?null:(job?.destinationUnitId||meal.unitId),
      routeReconciliationRequired:routeMismatch||job?.state==='ROUTE_RECONCILIATION_REQUIRED',
      mainMealAlert:meal.mealType==='PRIMARY'&&meal.status!=='DELIVERED'&&timing.principalDeliveryTolerancePassed?
        'Principal além da tolerância: alertar assistência e avaliar secundária/conduta excepcional':null};
  }
  /** No URL identifiers or public QR. This HTML is private and must be delivered POST-only, no-store. */
  printLabel(scope,{unitId,mealId,format='80mm'}){
    const meal=this._meal(scope,mealId,unitId),job=this._job(scope,meal);
    assertHospital(['ASSEMBLED','CHECKED','DISPATCHED','RECEIVED'].includes(job.state),'PRECONDITION','Etiqueta não pode ser emitida nesse estado');
    const {admission}=this._validateSnapshot(scope,meal,job);
    assertHospital(['80mm','A6','A4'].includes(format),'INVALID','Formato de etiqueta inválido');
    const patient=this.store.get(scope.organizationId,'patient',admission.patientId);
    assertHospital(patient&&patient.referenceCode,'PRECONDITION','Identificador de paciente ausente');
    const code=esc(job.labelCode),name=esc(patient.displayName||'Identificação adicional na unidade');
    const tags=esc([...new Set([...(meal.dietRestrictionCodes||[]),...(admission.allergyCodes||[]),...(job.ingredientCodes||[])])].join(', ')||'Conferir prontuário');
    const size=format==='80mm'?'80mm':format==='A6'?'105mm':'210mm';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;"><title>Etiqueta hospitalar</title><style>@page{size:auto;margin:4mm}body{font:14px Arial,sans-serif;max-width:'+size+';padding:4mm}p{margin:6px 0}strong{font-weight:700}.critical{border:2px solid #000;padding:6px}</style></head><body><h2>Refeição hospitalar</h2><p><strong>Identificação:</strong> '+name+' — '+esc(patient.referenceCode)+'</p><p><strong>Unidade/leito:</strong> '+esc(job.destinationUnitId)+' / '+esc(job.destinationBedId||'a confirmar')+'</p><p><strong>Dieta:</strong> '+esc(meal.dietCode)+' — '+esc(meal.mealType)+' / '+esc(meal.cycleId)+'</p><p class="critical"><strong>Alergias/restrições relevantes:</strong> '+tags+'</p><p><strong>Pedido:</strong> '+esc(meal.id)+' v'+esc(job.orderRevision)+'</p><p><strong>Código opaco:</strong> '+code+'</p><small>Confirmar dois identificadores antes de entregar. Não usar somente o leito. Código não é URL/QR público.</small></body></html>';
  }
}
