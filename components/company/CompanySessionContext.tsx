'use client';

import { createContext, useContext } from 'react';
import type { AuthorizedCompanySession } from '../../lib/company/companySessionClient';

export const CompanySessionContext = createContext<AuthorizedCompanySession | null>(null);

export function useCompanySession() {
  return useContext(CompanySessionContext);
}
