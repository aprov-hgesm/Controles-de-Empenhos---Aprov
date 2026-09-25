'use client';

import type { WarehouseSectionId } from '../navigation';
import { WarehouseHomeOperational } from './WarehouseHomeOperational';
import { WarehouseItemRegistrationOperational } from './WarehouseItemRegistrationOperational';
import { WarehouseDepotsOperational } from './WarehouseDepotsOperational';
import { WarehouseItemControlOperational } from './WarehouseItemControlOperational';

export function WarehouseSectionContent({
  section,
  workspaceId,
}: {
  section: WarehouseSectionId;
  workspaceId: string;
}) {
  switch (section) {
    case 'overview':
      return <WarehouseHomeOperational workspaceId={workspaceId} />;
    case 'registration':
      return <WarehouseItemRegistrationOperational workspaceId={workspaceId} />;
    case 'depots':
      return <WarehouseDepotsOperational workspaceId={workspaceId} />;
    case 'control':
      return <WarehouseItemControlOperational workspaceId={workspaceId} />;
  }
}
