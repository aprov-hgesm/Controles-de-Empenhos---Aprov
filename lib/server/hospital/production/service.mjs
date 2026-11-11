import { createHash } from 'node:crypto';
import { assertHospital, assertIdentifier, assertDate, CYCLES, assertMealReleaseSafe } from '../../../../features/hospital/core/domain.mjs';
import { requireHospitalPermission } from '../core/auth.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batchId = (org, key) => `batch_${digest([org, key]).slice(0, 24)}`;
const activeBatch = batch => !['CANCELLED'].includes(batch.status);
const pendingMeal = meal => meal.status === 'REQUESTED';
const nonEmpty = (value, label, max = 100) => {
  assertHospital(typeof value === 'string' && !!value.trim() && value.trim().length <= max, 'INVALID', `${label} inválido`);
  return value.trim();
};
const requireRevision = value => assertHospital(Number.isInteger(value) && value > 0, 'INVALID', 'expectedRevision obrigatório');
const onlyIds = ids => {
  assertHospital(Array.isArray(ids) && ids.length > 0 && ids.length <= 300 && ids.every(x => typeof x === 'string'), 'INVALID', 'Lista de pedidos inválida');
  const unique = [...new Set(ids)];
  assertHospital(unique.length === ids.length, 'CONFLICT', 'Pedido repetido no lote');
  unique.forEach(x => assertIdentifier(x, 'mealId'));
  return unique;
};
const toRestrictionKey = meal => JSON.stringify([...(meal.dietRestrictionCodes ?? [])].sort());
const publicState = reason => reason ? 'NEEDS_REVIEW' : 'CLEAR';

/** Serviço de cozinha. Só recebe HospitalScope emitido pelo servidor (W0). */
export class ProductionService {
  constructor(store) {
    assertHospital(store && typeof store.transaction === 'function' && typeof store.list === 'function', 'UNAVAILABLE', 'Storage hospitalar indisponível');
    this.store = store;
  }

  _units(scope, requested) {
    assertHospital(Array.isArray(requested) && requested.length > 0 && requested.length <= 40, 'INVALID', 'Selecione unidades autorizadas');
    const units = [...new Set(requested)];
    assertHospital(units.length === requested.length, 'INVALID', 'Unidade duplicada');
    units.forEach(unitId => requireHospitalPermission(scope, 'meal:production', unitId));
    return units;
  }

  _map(db, scope, meal) {
    const map = db.get(scope.organizationId, 'map', meal.mapId);
    return map && map.unitId === meal.unitId && map.localDate === meal.localDate && map.cycleId === meal.cycleId && ['SUBMITTED', 'CLOSED'].includes(map.status) ? map : null;
  }

  _safety(db, scope, meal) {
    if (meal.status === 'CANCELLED') return 'CANCELLED';
    if (meal.status === 'SUSPENDED') return 'SUSPENDED';
    if (meal.status === 'SAFETY_BLOCKED') return 'CLINICAL_BLOCK';
    if (!this._map(db, scope, meal)) return 'MAP_NOT_SUBMITTED';
    const admission = db.get(scope.organizationId, 'admission', meal.admissionId);
    if (!admission || admission.status !== 'ACTIVE') return 'ADMISSION_INACTIVE';
    if (admission.unitId !== meal.unitId) return 'LOCATION_CHANGED';
    if (admission.medicalReferenceId !== meal.medicalReferenceId) return 'DIET_CHANGED';
    const reference = db.get(scope.organizationId, 'medical_reference', meal.medicalReferenceId);
    if (!reference || reference.admissionId !== meal.admissionId || reference.catalogItemId !== meal.dietCode) return 'DIET_CHANGED';
    const catalog = db.get(scope.organizationId, 'catalog_diet', meal.dietCode);
    if (!catalog || !catalog.active) return 'DIET_UNAVAILABLE';
    try {
      assertMealReleaseSafe({
        fasting: admission.fasting,
        allergyCodes: admission.allergyCodes ?? [],
        dietRestrictionCodes: [...new Set([...(meal.dietRestrictionCodes ?? []), ...(catalog.restrictionCodes ?? [])])],
      });
    } catch { return admission.fasting ? 'FASTING' : 'ALLERGY_CONFLICT'; }
    return null;
  }

  _batch(db, scope, id, unitId) {
    requireHospitalPermission(scope, 'meal:production', unitId);
    assertIdentifier(id, 'batchId');
    const batch = db.get(scope.organizationId, 'production_batch', id);
    assertHospital(batch && batch.unitId === unitId, 'NOT_FOUND', 'Lote não encontrado para esta unidade');
    return batch;
  }

  _viewBatch(db, scope, batch) {
    const invalid = [];
    const active = [];
    for (const mealId of batch.mealIds) {
      const meal = db.get(scope.organizationId, 'meal', mealId);
      const reason = !meal || meal.unitId !== batch.unitId ? 'MEAL_MISSING' : this._safety(db, scope, meal);
      const expectedStatus = batch.status === 'PENDING' ? 'REQUESTED' : batch.status === 'IN_PROGRESS' || batch.status === 'NEEDS_REVIEW' ? 'PREPARING' : batch.status === 'COMPLETE' ? 'READY' : null;
      const problem = reason || (expectedStatus && meal.status !== expectedStatus ? 'STATUS_CHANGED' : null);
      if (problem) invalid.push({ mealId, reason: problem });
      else active.push(mealId);
    }
    return { ...batch, effectiveStatus: invalid.length && !['CANCELLED'].includes(batch.status) ? 'NEEDS_REVIEW' : batch.status, validation: publicState(invalid.length > 0), invalid, eligibleCount: active.length, totalCount: batch.mealIds.length };
  }

  /** Autorizações por unidade são repetidas na leitura; GET não aceita seleção de OM do cliente como permissão. */
  snapshot(scope, { unitIds, localDate, cycleId, statuses = [], dietCode = '', restriction = '', lateOnly = false, includeSuspended = true } = {}) {
    assertDate(localDate);
    assertHospital(!!CYCLES[cycleId], 'INVALID', 'Ciclo inválido');
    const units = this._units(scope, unitIds);
    assertHospital(Array.isArray(statuses) && statuses.every(x => typeof x === 'string'), 'INVALID', 'Filtro de estado inválido');
    const maps = [], meals = [], batches = [];
    const seen = new Set();
    for (const unitId of units) {
      const sentMaps = this.store.list(scope.organizationId, 'map', unitId).filter(x => x.localDate === localDate && x.cycleId === cycleId && ['SUBMITTED', 'CLOSED'].includes(x.status));
      const acceptedMapIds = new Set(sentMaps.map(x => x.id));
      maps.push(...sentMaps.map(m => ({ id:m.id, unitId:m.unitId, localDate:m.localDate, cycleId:m.cycleId, status:m.status, revision:m.revision, submittedAt:m.submittedAt, closedAt:m.closedAt })));
      for (const m of this.store.list(scope.organizationId, 'meal', unitId)) {
        if (!acceptedMapIds.has(m.mapId) || m.localDate !== localDate || m.cycleId !== cycleId || seen.has(m.id)) continue;
        seen.add(m.id); // dedupe por pedido canônico, nunca por leito/mapa/adendo
        if (statuses.length && !statuses.includes(m.status)) continue;
        if (dietCode && m.dietCode !== dietCode) continue;
        if (restriction && !(m.dietRestrictionCodes ?? []).includes(restriction)) continue;
        if (lateOnly && m.advisory === 'ROUTINE') continue;
        if (!includeSuspended && ['SUSPENDED','CANCELLED','SAFETY_BLOCKED'].includes(m.status)) continue;
        const issue = this._safety(this.store, scope, m);
        meals.push({ ...m, safetyIssue: issue, isLate: m.advisory !== 'ROUTINE' });
      }
      batches.push(...this.store.list(scope.organizationId, 'production_batch', unitId).filter(x => x.localDate === localDate && x.cycleId === cycleId).map(b => this._viewBatch(this.store, scope, b)));
    }
    const preparedByMeal = new Map();
    for (const batch of batches) {
      if (batch.status === 'CANCELLED') continue;
      for (const mealId of batch.mealIds) {
        if (!preparedByMeal.has(mealId)) preparedByMeal.set(mealId, new Set());
        preparedByMeal.get(mealId).add(batch.preparationLabel);
      }
    }
    const groups = new Map();
    for (const m of meals) {
      if (m.safetyIssue || ['CANCELLED','SUSPENDED','SAFETY_BLOCKED','DELIVERED','DISPATCHED','RECEIVED_BY_UNIT'].includes(m.status)) continue;
      const key = JSON.stringify([m.dietCode,m.mealType,toRestrictionKey(m)]);
      if (!groups.has(key)) groups.set(key,{ dietCode:m.dietCode, mealType:m.mealType, restrictionCodes:[...(m.dietRestrictionCodes ?? [])], preparationLabels:[], requested:0, preparing:0, ready:0, total:0 });
      const g=groups.get(key);for (const label of preparedByMeal.get(m.id) ?? []) if (!g.preparationLabels.includes(label)) g.preparationLabels.push(label);g.total++;
      if (m.status === 'REQUESTED') g.requested++;
      if (m.status === 'PREPARING') g.preparing++;
      if (m.status === 'READY') g.ready++;
    }
    const counts = { requested:0, preparing:0, ready:0, suspended:0, cancelled:0, blocked:0, late:0, extraordinary:0 };
    for (const meal of meals) {
      if (meal.status === 'REQUESTED') counts.requested++;
      if (meal.status === 'PREPARING') counts.preparing++;
      if (meal.status === 'READY') counts.ready++;
      if (meal.status === 'SUSPENDED') counts.suspended++;
      if (meal.status === 'CANCELLED') counts.cancelled++;
      if (meal.safetyIssue) counts.blocked++;
      if (meal.isLate) {counts.late++;counts.extraordinary++;}
    }
    maps.sort((a,b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
    meals.sort((a,b) => (a.requestedAt ?? '').localeCompare(b.requestedAt ?? '') || a.id.localeCompare(b.id));
    batches.sort((a,b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    return { at:this.store.now(), localDate, cycleId, maps, meals, batches, groups:[...groups.values()], counts };
  }

  createBatch(scope, { unitId, localDate, cycleId, mealIds, preparationLabel, idempotencyKey }) {
    requireHospitalPermission(scope, 'meal:production', unitId);
    assertDate(localDate);assertHospital(!!CYCLES[cycleId], 'INVALID', 'Ciclo inválido');
    assertIdentifier(idempotencyKey,'idempotencyKey');
    const ids = onlyIds(mealIds), label = nonEmpty(preparationLabel,'Preparação',120);
    const input = { unitId,localDate,cycleId,ids:ids.slice().sort(),label };
    return this.store.transaction(db => db.idempotent(scope.organizationId,'production.create',idempotencyKey,digest(input),() => {
      const selected = ids.map(id => {
        const meal=db.get(scope.organizationId,'meal',id);
        assertHospital(meal && meal.unitId===unitId && meal.localDate===localDate && meal.cycleId===cycleId, 'NOT_FOUND','Pedido não encontrado na fila autorizada');
        assertHospital(pendingMeal(meal), 'PRECONDITION', 'Pedido não está aguardando preparo');
        assertHospital(!this._safety(db,scope,meal),'PRECONDITION','Pedido requer revisão clínica ou mapa não enviado');
        return meal;
      });
      const first=selected[0];
      assertHospital(selected.every(x => x.dietCode===first.dietCode && x.mealType===first.mealType && toRestrictionKey(x)===toRestrictionKey(first)), 'PRECONDITION','Não misturar dietas, restrições ou tipo de refeição no mesmo lote');
      const existing=db.list(scope.organizationId,'production_batch',unitId).filter(activeBatch);
      assertHospital(!existing.some(b => b.mealIds.some(id => ids.includes(id))), 'CONFLICT','Pedido já alocado em outro lote');
      const id=batchId(scope.organizationId,idempotencyKey);
      const batch=db.put(scope.organizationId,'production_batch',unitId,{
        id,organizationId:scope.organizationId,unitId,localDate,cycleId,mealIds:ids,dietCode:first.dietCode,
        mealType:first.mealType,restrictionCodes:[...(first.dietRestrictionCodes??[])],preparationLabel:label,
        status:'PENDING',createdAt:db.now(),startedAt:null,completedAt:null,quantity:ids.length,preparedQuantity:0,
        excludedMealIds:[],actorUid:scope.uid,
      });
      db.appendEvent(scope.organizationId,'production_batch',id,'meal.production.batch.created',scope.uid,{unitId,localDate,cycleId,quantity:ids.length,mealIds:ids});
      return this._viewBatch(db,scope,batch);
    }));
  }

  startBatch(scope, {unitId,batchId:batchKey,expectedRevision,idempotencyKey}) {
    requireHospitalPermission(scope,'meal:production',unitId);requireRevision(expectedRevision);assertIdentifier(idempotencyKey);
    return this.store.transaction(db => db.idempotent(scope.organizationId,'production.start',idempotencyKey,digest([unitId,batchKey,expectedRevision]),() => {
      const b=this._batch(db,scope,batchKey,unitId);
      assertHospital(b.revision===expectedRevision,'CONFLICT','Lote alterado por outro cozinheiro');
      assertHospital(b.status==='PENDING','PRECONDITION','Somente lote pendente pode iniciar');
      for(const id of b.mealIds){const m=db.get(scope.organizationId,'meal',id);assertHospital(m&&m.status==='REQUESTED'&&!this._safety(db,scope,m),'PRECONDITION','Lote contém pedido cancelado, alterado ou inseguro');}
      for(const id of b.mealIds){const m=db.get(scope.organizationId,'meal',id);db.put(scope.organizationId,'meal',unitId,{...m,status:'PREPARING'},m.revision);db.appendEvent(scope.organizationId,'meal',id,'meal.production.started',scope.uid,{batchId:b.id,quantity:1,stage:'PREPARING'});}
      const updated=db.put(scope.organizationId,'production_batch',unitId,{...b,status:'IN_PROGRESS',startedAt:db.now()},b.revision);
      db.appendEvent(scope.organizationId,'production_batch',b.id,'meal.production.batch.started',scope.uid,{quantity:b.mealIds.length,mealIds:b.mealIds});
      return this._viewBatch(db,scope,updated);
    }));
  }

  completeBatch(scope,{unitId,batchId:batchKey,expectedRevision,confirmedQuantity,idempotencyKey}) {
    requireHospitalPermission(scope,'meal:production',unitId);requireRevision(expectedRevision);assertIdentifier(idempotencyKey);
    assertHospital(Number.isInteger(confirmedQuantity)&&confirmedQuantity>=0,'INVALID','Quantidade conferida inválida');
    return this.store.transaction(db=>db.idempotent(scope.organizationId,'production.complete',idempotencyKey,digest([unitId,batchKey,expectedRevision,confirmedQuantity]),()=>{
      const b=this._batch(db,scope,batchKey,unitId);
      assertHospital(b.revision===expectedRevision,'CONFLICT','Lote alterado por outro cozinheiro');
      assertHospital(b.status==='IN_PROGRESS','PRECONDITION','Lote não está em preparo');
      assertHospital(confirmedQuantity===b.mealIds.length,'PRECONDITION','Quantidade divergente: conferir o lote e registrar reconciliação');
      for(const id of b.mealIds){const m=db.get(scope.organizationId,'meal',id);assertHospital(m&&m.status==='PREPARING'&&!this._safety(db,scope,m),'PRECONDITION','Nova alteração clínica ou pedido indisponível: reconferência obrigatória');}
      for(const id of b.mealIds){const m=db.get(scope.organizationId,'meal',id);db.put(scope.organizationId,'meal',unitId,{...m,status:'READY'},m.revision);db.appendEvent(scope.organizationId,'meal',id,'meal.production.completed',scope.uid,{batchId:b.id,quantity:1,stage:'READY'});}
      const updated=db.put(scope.organizationId,'production_batch',unitId,{...b,status:'COMPLETE',preparedQuantity:confirmedQuantity,completedAt:db.now()},b.revision);
      db.appendEvent(scope.organizationId,'production_batch',b.id,'meal.production.batch.completed',scope.uid,{quantity:confirmedQuantity,mealIds:b.mealIds});
      return this._viewBatch(db,scope,updated);
    }));
  }

  /** Alterações W3/W2 podem invocar flagAffected; checks em leituras/escritas cobrem ausência da notificação. */
  flagAffected(scope,{unitId,mealId,reason}){
    requireHospitalPermission(scope,'meal:production',unitId);assertIdentifier(mealId);nonEmpty(reason,'Motivo',120);
    return this.store.transaction(db=>{
      const affected=[];
      for(const b of db.list(scope.organizationId,'production_batch',unitId).filter(b=>b.mealIds.includes(mealId)&&['PENDING','IN_PROGRESS'].includes(b.status))){
        const updated=db.put(scope.organizationId,'production_batch',unitId,{...b,status:'NEEDS_REVIEW'},b.revision);
        db.appendEvent(scope.organizationId,'production_batch',b.id,'meal.production.batch.review.required',scope.uid,{mealId,reason,stage:b.status});affected.push(updated.id);
      }
      return {affected};
    });
  }

  /** Reconcilia explicitamente só pedidos inelegíveis; nenhum item seguro é descartado automaticamente. */
  reconcileBatch(scope,{unitId,batchId:batchKey,expectedRevision,excludedMealIds,idempotencyKey}){
    requireHospitalPermission(scope,'meal:production',unitId);requireRevision(expectedRevision);assertIdentifier(idempotencyKey);
    const exclusions=onlyIds(excludedMealIds);
    return this.store.transaction(db=>db.idempotent(scope.organizationId,'production.reconcile',idempotencyKey,digest([unitId,batchKey,expectedRevision,exclusions.slice().sort()]),()=>{
      const b=this._batch(db,scope,batchKey,unitId);
      assertHospital(b.revision===expectedRevision,'CONFLICT','Lote alterado');
      assertHospital(['PENDING','IN_PROGRESS','NEEDS_REVIEW'].includes(b.status),'PRECONDITION','Lote encerrado');
      const stage=b.startedAt?'IN_PROGRESS':'PENDING';
      const view=this._viewBatch(db,scope,{...b,status:stage});
      assertHospital(exclusions.every(id=>b.mealIds.includes(id)&&view.invalid.some(e=>e.mealId===id)), 'PRECONDITION','Exclusão permitida apenas para pedido comprovadamente inelegível');
      const kept=b.mealIds.filter(id=>!exclusions.includes(id));
      assertHospital(kept.length>0,'PRECONDITION','Sem pedidos seguros remanescentes: cancelar lote');
      const after=this._viewBatch(db,scope,{...b,mealIds:kept,status:stage});
      assertHospital(after.invalid.length===0,'PRECONDITION','Ainda existem pedidos que exigem reconferência');
      const updated=db.put(scope.organizationId,'production_batch',unitId,{...b,mealIds:kept,quantity:kept.length,excludedMealIds:[...(b.excludedMealIds??[]),...exclusions],status:stage},b.revision);
      db.appendEvent(scope.organizationId,'production_batch',b.id,'meal.production.batch.reconciled',scope.uid,{excludedMealIds:exclusions,remainingCount:kept.length});
      return this._viewBatch(db,scope,updated);
    }));
  }

  acknowledgeBatch(scope,{unitId,batchId:batchKey,expectedRevision,idempotencyKey}){
    requireHospitalPermission(scope,'meal:production',unitId);requireRevision(expectedRevision);assertIdentifier(idempotencyKey);
    return this.store.transaction(db=>db.idempotent(scope.organizationId,'production.ack',idempotencyKey,digest([unitId,batchKey,expectedRevision]),()=>{
      const b=this._batch(db,scope,batchKey,unitId);
      assertHospital(b.revision===expectedRevision,'CONFLICT','Lote alterado');
      assertHospital(b.status==='NEEDS_REVIEW','PRECONDITION','Lote não aguarda reconferência');
      const stage=b.startedAt?'IN_PROGRESS':'PENDING';
      const view=this._viewBatch(db,scope,{...b,status:stage});
      assertHospital(view.invalid.length===0,'PRECONDITION','Pedidos inseguros: retirar apenas inelegíveis antes de prosseguir');
      const updated=db.put(scope.organizationId,'production_batch',unitId,{...b,status:stage},b.revision);
      db.appendEvent(scope.organizationId,'production_batch',b.id,'meal.production.batch.review.cleared',scope.uid,{quantity:b.mealIds.length});
      return this._viewBatch(db,scope,updated);
    }));
  }

  cancelBatch(scope,{unitId,batchId:batchKey,expectedRevision,reason,idempotencyKey}){
    requireHospitalPermission(scope,'meal:production',unitId);requireRevision(expectedRevision);assertIdentifier(idempotencyKey);nonEmpty(reason,'Justificativa',160);
    return this.store.transaction(db=>db.idempotent(scope.organizationId,'production.cancel',idempotencyKey,digest([unitId,batchKey,expectedRevision,reason]),()=>{
      const b=this._batch(db,scope,batchKey,unitId);
      assertHospital(b.revision===expectedRevision,'CONFLICT','Lote alterado');
      assertHospital(['PENDING','IN_PROGRESS','NEEDS_REVIEW'].includes(b.status),'PRECONDITION','Lote já encerrado');
      if(b.startedAt){for(const id of b.mealIds){const m=db.get(scope.organizationId,'meal',id);if(m&&m.status==='PREPARING'){db.put(scope.organizationId,'meal',unitId,{...m,status:'SUSPENDED'},m.revision);db.appendEvent(scope.organizationId,'meal',id,'meal.suspended',scope.uid,{reason:'BATCH_CANCELLED',batchId:b.id});}}}
      const updated=db.put(scope.organizationId,'production_batch',unitId,{...b,status:'CANCELLED',cancelReason:reason},b.revision);
      db.appendEvent(scope.organizationId,'production_batch',b.id,'meal.production.batch.cancelled',scope.uid,{quantity:b.mealIds.length,reason});
      return this._viewBatch(db,scope,updated);
    }));
  }
}
