type UnknownRecord = Record<string, unknown>;

function objectOrNull(value: unknown): UnknownRecord | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function canonicalPosition(value: unknown): unknown {
  const position = objectOrNull(value);
  if (!position || typeof position.kind !== 'string') return value;
  if (position.kind === 'UNASSIGNED') {
    return { kind: 'UNASSIGNED' };
  }
  if (position.kind === 'LOCATION' || position.kind === 'SUBPOSITION') {
    return {
      kind: position.kind,
      depotId: position.depotId,
      locationId: position.locationId,
      subpositionId: position.subpositionId ?? null,
    };
  }
  return value;
}

function canonicalUnit(value: unknown): unknown {
  const unit = objectOrNull(value);
  if (!unit) return value;
  return {
    code: unit.code,
    label: unit.label ?? null,
  };
}

function canonicalOrigin(value: unknown): unknown {
  const origin = objectOrNull(value);
  if (!origin) return value;
  return {
    kind: origin.kind,
    movementId: origin.movementId ?? null,
    invoiceRecordKey: origin.invoiceRecordKey ?? null,
    invoiceId: origin.invoiceId ?? null,
    supplier: origin.supplier ?? null,
    supplierCnpj: origin.supplierCnpj ?? null,
  };
}

export function warehouseCanonicalDepotReadInput(
  id: string,
  data: UnknownRecord
): UnknownRecord {
  return {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    code: data.code,
    name: data.name,
    description: data.description ?? null,
    visualType: data.visualType ?? 'STANDARD',
    sizeProfile: data.sizeProfile ?? 'MEDIUM',
    status: data.status,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
  };
}

export function warehouseCanonicalLocationReadInput(
  id: string,
  data: UnknownRecord
): UnknownRecord {
  return {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    depotId: data.depotId,
    kind: data.kind,
    parentLocationId: data.parentLocationId ?? null,
    code: data.code,
    name: data.name,
    description: data.description ?? null,
    status: data.status,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
  };
}

export function warehouseCanonicalLocationBalanceReadInput(
  id: string,
  data: UnknownRecord
): UnknownRecord {
  return {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    materialId: data.materialId,
    position: canonicalPosition(data.position),
    quantity: data.quantity,
    revision: data.revision,
    lastMovementId: data.lastMovementId,
  };
}

export function warehouseCanonicalMaterialReadInput(
  id: string,
  data: UnknownRecord
): UnknownRecord {
  const conversions = Array.isArray(data.conversions)
    ? data.conversions.map((entry) => {
        const conversion = objectOrNull(entry);
        if (!conversion) return entry;
        return {
          presentation: canonicalUnit(conversion.presentation),
          factorToBaseUnit: conversion.factorToBaseUnit,
        };
      })
    : data.conversions;

  return {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    description: data.description,
    aliases: data.aliases,
    unit: canonicalUnit(data.unit),
    status: data.status,
    conversions,
  };
}

export function warehouseCanonicalLotReadInput(
  id: string,
  data: UnknownRecord
): UnknownRecord {
  return {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    materialId: data.materialId,
    code: data.code,
    expiresOn: data.expiresOn ?? null,
    quantity: data.quantity,
    position: canonicalPosition(data.position),
    origin: canonicalOrigin(data.origin),
    status: data.status,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
  };
}

export function warehouseCanonicalBarcodeReadInput(
  id: string,
  data: UnknownRecord
): UnknownRecord {
  return {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    materialId: data.materialId,
    barcode: data.barcode,
    presentation: canonicalUnit(data.presentation),
    factorToBaseUnit: data.factorToBaseUnit,
    status: data.status,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
  };
}
