/** Project only W9 deliveries from a server-authorized tenant read.
 * A client-crafted destination is never proof of an existing W9 delivery.
 */
export function toVerifiedDeliveryCandidate(record, companyId) {
  if (!record || record.kind !== 'delivery' ||
      record.companyId !== companyId || record.workspaceId !== companyId ||
      !['planned','collected'].includes(record.deliveryState) ||
      typeof record.id !== 'string' || !record.id ||
      typeof record.customerOrderId !== 'string' || !record.customerOrderId ||
      typeof record.customerOrderLineId !== 'string' || !record.customerOrderLineId ||
      record.destination?.confirmed !== true ||
      typeof record.destination.address !== 'string' || !record.destination.address.trim() ||
      typeof record.quantity?.value !== 'string' || !/^\d+(?:\.\d{1,3})?$/.test(record.quantity.value) ||
      typeof record.quantity.unit !== 'string' || !record.quantity.unit) return null;
  const address = record.destination.address;
  const destination = {address,confirmed:true};
  const {latitude,longitude,coordinateSource} = record.destination;
  if(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
     Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 &&
     typeof coordinateSource === 'string' && coordinateSource.trim()){
    Object.assign(destination,{latitude,longitude,coordinateSource});
  }
  return {
    companyId,workspaceId:companyId,deliveryId:record.id,
    customerOrderId:record.customerOrderId,
    customerOrderLineId:record.customerOrderLineId,
    quantity:{value:record.quantity.value,unit:record.quantity.unit},
    destination,
    ...(record.receptionWindow && typeof record.receptionWindow.start==='string' &&
       typeof record.receptionWindow.end==='string' ?
       {receptionWindow:{start:record.receptionWindow.start,end:record.receptionWindow.end}} : {}),
    ...(Number.isFinite(record.weightKg) && record.weightKg>0 ? {weightKg:record.weightKg} : {}),
    ...(Number.isFinite(record.volumeM3) && record.volumeM3>0 ? {volumeM3:record.volumeM3} : {}),
    ...(Number.isFinite(record.unloadMinutes) && record.unloadMinutes>=0 ?
       {unloadMinutes:record.unloadMinutes} : {}),
  };
}
