'use client';

import type { WarehouseSectionId } from '../navigation';
import { WarehouseSectionContent } from './WarehouseSectionContent';

// A seção ativa é montada no shell persistente, não por troca de rotas Next.
// Os seis componentes seguem carregados sob demanda via dynamic().
export function WarehouseTabContent({
  section,
  workspaceId,
}: {
  section: WarehouseSectionId;
  workspaceId: string;
}) {
  return <WarehouseSectionContent section={section} workspaceId={workspaceId} />;
}
