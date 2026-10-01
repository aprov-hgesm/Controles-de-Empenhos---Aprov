'use client';

import type { WarehouseSectionId } from '../navigation';
import { WarehouseSectionContent } from './WarehouseSectionContent';
import { useWarehouseWorkspaceContext } from './WarehouseModuleContext';

export function WarehouseRouteContent({
  section,
}: {
  section: WarehouseSectionId;
}) {
  const workspaceContext = useWarehouseWorkspaceContext();

  return (
    <WarehouseSectionContent
      section={section}
      workspaceId={workspaceContext.workspaceId}
    />
  );
}
