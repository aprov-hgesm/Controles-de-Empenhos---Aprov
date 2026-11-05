import type { ReactNode } from 'react';
import { CompanySessionGate } from '../../components/company/CompanySessionGate';

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return <CompanySessionGate>{children}</CompanySessionGate>;
}
