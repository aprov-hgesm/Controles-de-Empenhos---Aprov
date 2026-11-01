import { NextResponse } from 'next/server';

import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import {
  verifyWarehouseRequest,
  WarehouseAccessError,
} from '../../../../lib/server/warehouseAccess';
import {
  WAREHOUSE_DOMAIN_COLLECTIONS,
  WAREHOUSE_NAMESPACE_ROOT,
  WAREHOUSE_NAMESPACE_VERSION,
} from '../../../../lib/warehouse/namespace';
import {
  WAREHOUSE_MATERIAL_SCHEMA_VERSION,
  WAREHOUSE_MATERIAL_UNIT_CODES,
} from '../../../../lib/warehouse/material';
import {
  WAREHOUSE_BALANCE_SCHEMA_VERSION,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
  WAREHOUSE_MOVEMENT_TYPES,
} from '../../../../lib/warehouse/movement';

export async function GET(request: Request) {
  try {
    const access = await verifyWarehouseRequest(request.headers.get('authorization'));

    return NextResponse.json({
      enabled: true,
      phase: 2,
      workspaceId: access.workspaceId,
      ug: access.ug,
      claimsUpdated: access.claimsUpdated,
      namespace: WAREHOUSE_NAMESPACE_ROOT,
      namespaceVersion: WAREHOUSE_NAMESPACE_VERSION,
      domains: Object.values(WAREHOUSE_DOMAIN_COLLECTIONS),
      material: {
        schemaVersion: WAREHOUSE_MATERIAL_SCHEMA_VERSION,
        units: WAREHOUSE_MATERIAL_UNIT_CODES,
      },
      ledger: {
        schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
        types: WAREHOUSE_MOVEMENT_TYPES,
      },
      balance: {
        schemaVersion: WAREHOUSE_BALANCE_SCHEMA_VERSION,
        materialized: true,
      },
    });
  } catch (error) {
    if (error instanceof FounderAuthError || error instanceof WarehouseAccessError) {
      return NextResponse.json(
        { error: 'WAREHOUSE_ACCESS_DENIED' },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'WAREHOUSE_ACCESS_DENIED' },
      { status: 403 }
    );
  }
}
