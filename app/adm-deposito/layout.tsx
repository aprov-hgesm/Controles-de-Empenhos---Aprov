import type { ReactNode } from 'react';

import { WarehouseProtectedLayout } from '../../features/warehouse/components/WarehouseProtectedSurface';

export default function WarehouseLayout({ children }: { children: ReactNode }) {
  return <WarehouseProtectedLayout>{children}</WarehouseProtectedLayout>;
}
