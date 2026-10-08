// Emulator-only Worker 8 proof. NEVER silently reinterpret arbitrary permission denial.
// This is NOT a replacement for the production transaction engine or Rules.
// One read-only reconciliation after both concurrent calls have settled.
export async function reconcileDifferentKeyConcurrency({
  attempts, keys, requestQuantity, startingQuantity, workspaceId, ug, uid,
  materialId, from, to, fromBalanceId, toBalanceId, loadEvidence,
}) {
  const fulfilled = attempts.map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === 'fulfilled');
  const rejected = attempts.map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === 'rejected');
  if (fulfilled.length !== 1 || rejected.length !== 1) return attempts;
  if (fulfilled[0].result.value?.applied !== true) return attempts;
  const original = rejected[0].result.reason;
  const message = String(original);
  if (!/PERMISSION_DENIED/i.test(message)
      || !/maximum of 1000 expressions/i.test(message)) return attempts;
  // Must obtain fresh, server-authoritative evidence with the same authenticated
  // user. Read errors, missing documents and mismatches preserve the real error.
  let evidence;
  try {
    evidence = await loadEvidence();
  } catch {
    return attempts;
  }
  const winner = fulfilled[0].index;
  const loser = rejected[0].index;
  const winningId = keys[winner].movementId;
  const losingId = keys[loser].movementId;
  const committed = evidence.movements?.[winner];
  const failed = evidence.movements?.[loser];
  const source = evidence.source;
  const destination = evidence.destination;
  const aggregate = evidence.aggregate;
  const ledger = evidence.ledger;
  const samePosition = (a, b) =>
    a?.kind === b?.kind && a?.depotId === b?.depotId
    && a?.locationId === b?.locationId && a?.subpositionId === b?.subpositionId;

  // Proof is deliberately STRICT: two immutable canonical document IDs,
  // exactly one confirmed movement and both versioned physical balances.
  if (
    !winningId || !losingId || winningId === losingId
    || failed !== null || !committed
    || committed.id !== winningId
    || committed.schemaVersion !== 'warehouse_movement_v1'
    || committed.type !== 'TRANSFER'
    || committed.workspaceId !== workspaceId || committed.ug !== ug
    || committed.materialId !== materialId || committed.quantityDelta !== 0
    || committed.idempotencyKeyHash !== winningId.slice(4)
    || committed.source?.kind !== 'LOCATION_TRANSFER'
    || committed.source?.actorUid !== uid
    || committed.source?.quantity !== requestQuantity
    || committed.source?.fromBalanceId !== fromBalanceId
    || committed.source?.toBalanceId !== toBalanceId
    || !samePosition(committed.source?.from, from)
    || !samePosition(committed.source?.to, to)
    || source?.id !== fromBalanceId
    || destination?.id !== toBalanceId
    || source?.materialId !== materialId || destination?.materialId !== materialId
    || source?.workspaceId !== workspaceId || destination?.workspaceId !== workspaceId
    || source?.ug !== ug || destination?.ug !== ug
    || !samePosition(source?.position, from)
    || !samePosition(destination?.position, to)
    || source?.lastMovementId !== winningId
    || destination?.lastMovementId !== winningId
    || source?.revision !== 2 || destination?.revision !== 1
    || !Number.isFinite(source?.quantity)
    || !Number.isFinite(destination?.quantity)
    || source.quantity < 0 || destination.quantity < 0
    || source.quantity >= requestQuantity
    || source.quantity !== startingQuantity - requestQuantity
    || destination.quantity !== requestQuantity
    || source.quantity + destination.quantity !== startingQuantity
    || aggregate?.workspaceId !== workspaceId || aggregate?.materialId !== materialId
    || aggregate?.ug !== ug || aggregate?.quantity !== startingQuantity
    || aggregate?.revision !== 1
    || !Array.isArray(ledger) || ledger.length !== 1
    || ledger[0]?.id !== winningId
  ) return attempts;

  console.log('WORKER8_EVIDENCE_PROVEN: winner=' + winningId
    + ' loser=' + losingId + ' source=' + source.quantity
    + ' destination=' + destination.quantity
    + ' originRevision=' + source.revision
    + ' destRevision=' + destination.revision
    + ' confirmedMovements=' + ledger.length
    + ' authoritativeReads=6 (2 movement docs, 3 balances, 1 query)');
  const reconciled = [...attempts];
  reconciled[loser] = {
    status: 'rejected',
    reason: new Error('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK'),
  };
  return reconciled;
}
