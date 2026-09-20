'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { getDoc, onSnapshot, setDoc } from 'firebase/firestore';

import type { Alert, Empenho } from '../../../lib/types';
import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import {
  operationalScopeFromContext,
  operationalSettingsDocRef,
} from '../../../lib/operationalPaths';
import {
  isOperationalSectorContext,
  type ResolvedWorkspaceContext,
} from '../../../lib/workspaceContext';
import {
  recordWorkspaceDocumentReads,
  recordWorkspaceDocumentWrites,
  recordWorkspaceRealtimeSnapshot,
  trackWorkspaceRealtimeListener,
} from '../../../lib/workspaceUsageTelemetry';
import {
  buildInicioOperationalSnapshot,
  INICIO_SNAPSHOT_DOCUMENT_ID,
  isInicioOperationalSnapshot,
  type InicioOperationalSnapshot,
} from '../domain/homeOperationalSnapshot';

interface UseInicioOperationalSnapshotInput {
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  activeTab: OperationalActiveTab;
  empenhos: Empenho[];
  alerts: Alert[];
  empenhosReady: boolean;
  alertsReady: boolean;
}

interface KnownRemoteState {
  workspaceId: string | null;
  loaded: boolean;
  hash: string | null;
}

const SNAPSHOT_PUBLISH_DEBOUNCE_MS = 900;

function shouldPublishSnapshot(activeTab: OperationalActiveTab): boolean {
  return activeTab === 'empenhos' || activeTab === 'nova_nf' || activeTab === 'avisos';
}

export function useInicioOperationalSnapshot({
  user,
  workspaceContext,
  activeTab,
  empenhos,
  alerts,
  empenhosReady,
  alertsReady,
}: UseInicioOperationalSnapshotInput) {
  const [snapshot, setSnapshot] = useState<InicioOperationalSnapshot | null>(null);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const knownRemoteRef = useRef<KnownRemoteState>({
    workspaceId: null,
    loaded: false,
    hash: null,
  });

  useEffect(() => {
    if (!isOperationalSectorContext(workspaceContext)) {
      knownRemoteRef.current = {
        workspaceId: null,
        loaded: false,
        hash: null,
      };
      setSnapshot(null);
      setSnapshotReady(false);
      return;
    }

    if (knownRemoteRef.current.workspaceId !== workspaceContext.workspaceId) {
      knownRemoteRef.current = {
        workspaceId: workspaceContext.workspaceId,
        loaded: false,
        hash: null,
      };
      setSnapshot(null);
      setSnapshotReady(false);
    }
  }, [workspaceContext]);

  useEffect(() => {
    if (
      activeTab !== 'inicio'
      || !user
      || !isOperationalSectorContext(workspaceContext)
    ) {
      return;
    }

    const scope = operationalScopeFromContext(workspaceContext);
    const snapshotRef = operationalSettingsDocRef(
      scope,
      INICIO_SNAPSHOT_DOCUMENT_ID
    );

    setSnapshotReady(false);
    const stopTrackingListener = trackWorkspaceRealtimeListener(scope);

    const unsubscribe = onSnapshot(
      snapshotRef,
      (documentSnapshot) => {
        recordWorkspaceRealtimeSnapshot(scope, 1);

        const data = documentSnapshot.exists()
          ? documentSnapshot.data()
          : null;

        const parsed = isInicioOperationalSnapshot(
          data,
          scope.workspaceId,
          scope.ug
        )
          ? data
          : null;

        knownRemoteRef.current = {
          workspaceId: scope.workspaceId,
          loaded: true,
          hash: parsed?.contentHash ?? null,
        };

        setSnapshot(parsed);
        setSnapshotReady(true);
      },
      (error) => {
        console.warn('Não foi possível observar o snapshot econômico do Início.', error);
        setSnapshotReady(true);
      }
    );

    return () => {
      unsubscribe();
      stopTrackingListener();
    };
  }, [activeTab, user, workspaceContext]);

  useEffect(() => {
    if (
      !user
      || !isOperationalSectorContext(workspaceContext)
      || !shouldPublishSnapshot(activeTab)
      || !empenhosReady
      || !alertsReady
    ) {
      return;
    }

    const scope = operationalScopeFromContext(workspaceContext);
    const candidate = buildInicioOperationalSnapshot({
      workspaceId: scope.workspaceId,
      ug: scope.ug,
      generatedBy: user.uid,
      empenhos,
      alerts,
    });

    const timer = window.setTimeout(() => {
      void (async () => {
        const snapshotRef = operationalSettingsDocRef(
          scope,
          INICIO_SNAPSHOT_DOCUMENT_ID
        );

        let knownRemote = knownRemoteRef.current;

        if (
          knownRemote.workspaceId !== scope.workspaceId
          || !knownRemote.loaded
        ) {
          try {
            const current = await getDoc(snapshotRef);
            recordWorkspaceDocumentReads(scope, 1);

            const data = current.exists() ? current.data() : null;
            const parsed = isInicioOperationalSnapshot(
              data,
              scope.workspaceId,
              scope.ug
            )
              ? data
              : null;

            knownRemote = {
              workspaceId: scope.workspaceId,
              loaded: true,
              hash: parsed?.contentHash ?? null,
            };
            knownRemoteRef.current = knownRemote;

            if (parsed) setSnapshot(parsed);
          } catch (error) {
            console.warn(
              'Não foi possível comparar o snapshot econômico antes da publicação.',
              error
            );
            return;
          }
        }

        if (knownRemote.hash === candidate.contentHash) return;

        try {
          await setDoc(snapshotRef, candidate);
          recordWorkspaceDocumentWrites(scope, 1);

          knownRemoteRef.current = {
            workspaceId: scope.workspaceId,
            loaded: true,
            hash: candidate.contentHash,
          };
          setSnapshot(candidate);
        } catch (error) {
          console.warn('Não foi possível atualizar o snapshot econômico do Início.', error);
        }
      })();
    }, SNAPSHOT_PUBLISH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    alerts,
    alertsReady,
    empenhos,
    empenhosReady,
    user,
    workspaceContext,
  ]);

  return {
    snapshot,
    snapshotReady,
  };
}
