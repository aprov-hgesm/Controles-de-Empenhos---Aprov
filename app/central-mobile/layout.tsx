import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { WarehouseMobileProtectedLayout } from '../../features/warehouse/mobile/WarehouseMobileProtectedLayout';

export const metadata: Metadata = {
  title: 'Central Móvel · EMPROVEX',
  description: 'Superfície móvel operacional da Central de Depósitos.',
};

export default function CentralMobileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WarehouseMobileProtectedLayout>
      {children}
    </WarehouseMobileProtectedLayout>
  );
}
