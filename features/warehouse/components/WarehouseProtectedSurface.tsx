'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { EmprovexAuthLoading } from '../../../components/auth/EmprovexAuthLoading';
import { auth } from '../../../lib/firebase';
import { resolveAuthenticatedWorkspaceContext } from '../../../lib/platformAccess';
import { canAccessWarehouseModule } from '../../../lib/warehouse/featureFlag';
import type { WarehouseSectionId } from '../navigation';
import { WarehouseModuleShell } from './WarehouseModuleShell';

type GateState = 'checking' | 'allowed' | 'denied';

export function WarehouseProtectedSurface({ section }: { section: WarehouseSectionId }) {
  const [gateState, setGateState] = useState<GateState>('checking');

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (active) setGateState('denied');
        window.location.replace('/');
        return;
      }

      try {
        const context = await resolveAuthenticatedWorkspaceContext(currentUser);
        if (!active) return;

        if (!canAccessWarehouseModule(context)) {
          setGateState('denied');
          window.location.replace('/');
          return;
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/adm-deposito/status', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          setGateState('denied');
          window.location.replace('/');
          return;
        }

        setGateState('allowed');
      } catch {
        if (!active) return;
        setGateState('denied');
        window.location.replace('/');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [];

  if (gateState !== 'allowed') {
    return <EmprovexAuthLoading hasAuthenticatedIdentity={gateState === 'checking'} />;
  }

  return <WarehouseModuleShell section={section} />;
}
