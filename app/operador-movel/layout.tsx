import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { WarehouseMobileProtectedLayout } from '../../features/warehouse/mobile/WarehouseMobileProtectedLayout';

export const metadata: Metadata = {
  title: 'Operador Móvel · Central de Depósitos | EMPROVEX',
  description: 'Superfície móvel operacional da Central de Depósitos.',
};

export default function OperadorMovelLayout({
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
