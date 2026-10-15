import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import { WarehouseProtectedLayout } from '../../features/warehouse/components/WarehouseProtectedSurface';

export const metadata: Metadata = {
  title: 'Central de Depósitos · EMPROVEX',
  description: 'Gestão logística, estoque, localização e rastreabilidade dos depósitos.',
};

export default function WarehouseLayout({ children }: { children: ReactNode }) {
  return <WarehouseProtectedLayout>{children}</WarehouseProtectedLayout>;
}
