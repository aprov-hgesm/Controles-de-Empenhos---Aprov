/** Cross-worker W9/W11 boundary. Route approval is only a planning decision.
 * The W9 shipment remains the authoritative object for dispatch/proof.
 */
export function approvedStopForDelivery(plan, delivery) {
  if (!plan || plan.status !== 'approved' || plan.approvedByHuman !== true ||
      typeof plan.approvedByUid !== 'string' || !plan.approvedByUid) {
    return { ok: false, code: 'ROUTE_NOT_APPROVED' };
  }
  const stops = Array.isArray(plan.stops) ? plan.stops : [];
  const stop = stops.find(x => x?.candidateDeliveryId === delivery.id);
  if (!stop || !Number.isSafeInteger(stop.sequence) || stop.sequence < 1 ||
      !stop.vehicleId || (plan.unassigned || []).some(x => x?.candidateDeliveryId === delivery.id)) {
    return { ok: false, code: 'ROUTE_STOP_NOT_APPROVED' };
  }
  const candidates = Array.isArray(plan.candidates) ? plan.candidates : [];
  const candidate = candidates.find(x => x?.deliveryId === delivery.id);
  if (!candidate || candidate.companyId !== delivery.companyId ||
      candidate.workspaceId !== delivery.workspaceId ||
      candidate.customerOrderId !== delivery.customerOrderId ||
      candidate.customerOrderLineId !== delivery.customerOrderLineId ||
      candidate.destination?.confirmed !== true ||
      candidate.destination.address !== delivery.destination?.address ||
      candidate.quantity?.value !== delivery.quantity?.value ||
      candidate.quantity?.unit !== delivery.quantity?.unit) {
    return { ok: false, code: 'ROUTE_CANDIDATE_STALE' };
  }
  // A driver cannot receive a delivery by substituting a different vehicle in a route.
  const vehicle = (Array.isArray(plan.vehicles) ? plan.vehicles : [])
    .find(x => x?.id === stop.vehicleId);
  if (!vehicle || vehicle.driverUid !== delivery.driverUid) {
    return { ok: false, code: 'ROUTE_DRIVER_MISMATCH' };
  }
  return { ok: true, sequence: stop.sequence, vehicleId: stop.vehicleId };
}
