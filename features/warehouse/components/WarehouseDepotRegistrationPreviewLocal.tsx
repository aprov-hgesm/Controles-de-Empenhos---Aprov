'use client';

import { WarehouseDepotRegistrationR1 } from './WarehouseDepotRegistrationR1';

/** Interactive UX preview: demo submissions are intercepted before Firestore I/O. */
export function WarehouseDepotRegistrationPreviewLocal() {
  return <WarehouseDepotRegistrationR1
    workspaceId="demo-local-nao-persistido"
    depots={[]}
    previewOnly
    onRegistered={async () => {}}
  />;
}
