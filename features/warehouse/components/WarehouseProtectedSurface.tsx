'use client';

import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';

import { EmprovexAuthLoading } from '../../../components/auth/EmprovexAuthLoading';
import { LegalAcceptanceGate } from '../../../components/legal/LegalAcceptanceGate';
import { auth } from '../../../lib/firebase';
import { resolveAuthenticatedWorkspaceContext } from '../../../lib/platformAccess';
import { startWorkspaceSessionControl } from '../../../lib/platformSessionControl';
import { clearLocalWorkspaceSessionLease } from '../../../lib/platformSessionLease';
import { resetActiveProfileMode } from '../../../lib/profileMode';
import { canAccessWarehouseModule } from '../../../lib/warehouse/featureFlag';
import {
  clearResolvedWorkspaceContext,
  type SectorWorkspaceContext,
} from '../../../lib/workspaceContext';
import { WarehouseWorkspaceProvider } from './WarehouseModuleContext';
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

export function WarehouseAccessBoundary({
  children,
}: {
  children: (workspaceContext: SectorWorkspaceContext) => ReactNode;
}) {
  const [gateState, setGateState] = useState<GateState>('checking');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workspaceContext, setWorkspaceContext] =
    useState<SectorWorkspaceContext | null>(null);

  useEffect(() => {
    let active = true;

    const denyAccess = () => {
      if (!active) return;
      setGateState('denied');
      setCurrentUser(null);
      setWorkspaceContext(null);
      clearResolvedWorkspaceContext();
      resetActiveProfileMode();
      window.location.replace('/');
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        denyAccess();
        return;
      }

      setGateState('checking');

      try {
        const context = await resolveAuthenticatedWorkspaceContext(currentUser);
        if (!active) return;

        if (!canAccessWarehouseModule(context) || context.status !== 'sector') {
          denyAccess();
          return;
        }

        let authorization = await requestWarehouseStatus(currentUser);

        if (authorization.ok && authorization.status.claimsUpdated) {
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
          denyAccess();
          return;
        }

        setCurrentUser(currentUser);
        setWorkspaceContext(context);
        setGateState('allowed');
      } catch {
        denyAccess();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const sessionIdentityKey = (
    currentUser
    && workspaceContext
    && workspaceContext.resolutionSource === 'platform-directory'
  )
    ? [
        currentUser.uid,
        workspaceContext.workspaceId,
        workspaceContext.email,
        workspaceContext.ug || '',
      ].join('|')
    : null;

  useEffect(() => {
    if (
      !sessionIdentityKey
      || !currentUser
      || !workspaceContext
      || workspaceContext.resolutionSource !== 'platform-directory'
    ) {
      return;
    }

    let active = true;

    const invalidateSession = () => {
      if (!active) return;
      active = false;

      clearLocalWorkspaceSessionLease(
        workspaceContext.workspaceId,
        currentUser.uid
      );
      clearResolvedWorkspaceContext();
      resetActiveProfileMode();

      setGateState('denied');
      setCurrentUser(null);
      setWorkspaceContext(null);

      void signOut(auth).finally(() => {
        window.location.replace('/');
      });
    };

    const sessionControl = startWorkspaceSessionControl(
      currentUser,
      workspaceContext,
      {
        onSessionInvalid: () => invalidateSession(),
        onTransientError: (error) => {
          console.warn(
            'Falha transitória no controle da sessão da Central de Depósitos.',
            error
          );
        },
      }
    );

    return () => {
      active = false;
      sessionControl.stop();
    };
  }, [sessionIdentityKey, currentUser, workspaceContext]);

  if (gateState !== 'allowed' || !workspaceContext) {
    return (
      <EmprovexAuthLoading
        hasAuthenticatedIdentity={gateState === 'checking'}
      />
    );
  }

  if (!currentUser) {
    return <EmprovexAuthLoading hasAuthenticatedIdentity />;
  }

  return (
    <LegalAcceptanceGate
      identity={{
        workspaceId: workspaceContext.workspaceId,
        uid: currentUser.uid,
        email: currentUser.email || workspaceContext.email,
        ug: workspaceContext.ug,
      }}
    >
      <WarehouseWorkspaceProvider value={workspaceContext}>
        {children(workspaceContext)}
      </WarehouseWorkspaceProvider>
    </LegalAcceptanceGate>
  );
}

export function WarehouseProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WarehouseAccessBoundary>
      {(workspaceContext) => (
        <WarehouseModuleShell workspaceContext={workspaceContext}>
          {children}
        </WarehouseModuleShell>
      )}
    </WarehouseAccessBoundary>
  );
}
