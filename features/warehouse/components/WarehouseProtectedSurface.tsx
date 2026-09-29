'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { EmprovexAuthLoading } from '../../../components/auth/EmprovexAuthLoading';
import { auth } from '../../../lib/firebase';
import { resolveAuthenticatedWorkspaceContext } from '../../../lib/platformAccess';
import { canAccessWarehouseModule } from '../../../lib/warehouse/featureFlag';
import type { SectorWorkspaceContext } from '../../../lib/workspaceContext';
import type { WarehouseSectionId } from '../navigation';
import { WarehouseModuleShell } from './WarehouseModuleShell';

type GateState = 'checking' | 'allowed' | 'denied';

interface WarehouseStatusPayload {
  workspaceId?: string;
  ug?: string;
  claimsUpdated?: boolean;
}

async function requestWarehouseStatus(
  currentUser: User,
  forceTokenRefresh = false
): Promise<{ ok: boolean; status: WarehouseStatusPayload }> {
  const idToken = await currentUser.getIdToken(forceTokenRefresh);
  const response = await fetch('/api/adm-deposito/status', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: 'no-store',
  });

  let status: WarehouseStatusPayload = {};
  try {
    status = await response.json() as WarehouseStatusPayload;
  } catch {
    status = {};
  }

  return {
    ok: response.ok,
    status,
  };
}

export function WarehouseProtectedSurface({ section }: { section: WarehouseSectionId }) {
  const [gateState, setGateState] = useState<GateState>('checking');
  const [workspaceContext, setWorkspaceContext] = useState<SectorWorkspaceContext | null>(null);

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

        if (!canAccessWarehouseModule(context) || context.status !== 'sector') {
          setGateState('denied');
          window.location.replace('/');
          return;
        }

        let authorization = await requestWarehouseStatus(currentUser);

        if (
          authorization.ok
          && authorization.status.claimsUpdated
        ) {
          authorization = await requestWarehouseStatus(currentUser, true);
        }

        if (
          !authorization.ok
          || authorization.status.workspaceId !== context.workspaceId
          || (
            context.ug
            && authorization.status.ug !== context.ug
          )
        ) {
          setGateState('denied');
          window.location.replace('/');
          return;
        }

        setWorkspaceContext(context);
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
  }, []);

  if (gateState !== 'allowed' || !workspaceContext) {
    return <EmprovexAuthLoading hasAuthenticatedIdentity={gateState === 'checking'} />;
  }

  return <WarehouseModuleShell section={section} workspaceContext={workspaceContext} />;
}
