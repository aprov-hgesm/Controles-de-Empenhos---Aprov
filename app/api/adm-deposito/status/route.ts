import { NextResponse } from 'next/server';

import { HGESM_WORKSPACE_ID } from '../../../../lib/hgesmWorkspace';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import {
  verifyWarehouseFounderRequest,
  WarehouseAccessError,
} from '../../../../lib/server/warehouseAccess';
import {
  WAREHOUSE_DOMAIN_COLLECTIONS,
  WAREHOUSE_NAMESPACE_ROOT,
  WAREHOUSE_NAMESPACE_VERSION,
} from '../../../../lib/warehouse/namespace';

export async function GET(request: Request) {
  try {
    await verifyWarehouseFounderRequest(request.headers.get('authorization'));

    return NextResponse.json({
      enabled: true,
      phase: 0,
      workspaceId: HGESM_WORKSPACE_ID,
      namespace: WAREHOUSE_NAMESPACE_ROOT,
      namespaceVersion: WAREHOUSE_NAMESPACE_VERSION,
      domains: Object.values(WAREHOUSE_DOMAIN_COLLECTIONS),
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
