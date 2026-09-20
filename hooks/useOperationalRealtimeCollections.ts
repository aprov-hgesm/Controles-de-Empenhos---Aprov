'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { User } from 'firebase/auth';
import {
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  Alert,
  Comissao,
  CronogramaEmpenho,
  Empenho,
  Invoice,
} from '../lib/types';
import {
  getOperationalCollectionPath,
  operationalCollectionRef,
  operationalScopeFromContext,
} from '../lib/operationalPaths';
import {
  buildOperationalSubscriptionPlan,
  countRealtimeOperationalCollections,
  getRequiredRealtimeCollections,
  type OperationalActiveTab,
  type RealtimeOperationalCollection,
} from '../lib/operationalSubscriptionPlan';
import {
  isOperationalSectorContext,
  type ResolvedWorkspaceContext,
} from '../lib/workspaceContext';
import { normalizeSupplier } from '../features/empenhos/domain/empenhoHelpers';
import {
  recordWorkspaceRealtimeSnapshot,
  trackWorkspaceRealtimeListener,
} from '../lib/workspaceUsageTelemetry';

interface OperationalRealtimeCollectionsInput {
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  activeTab: OperationalActiveTab;
  setEmpenhos: Dispatch<SetStateAction<Empenho[]>>;
  setAlerts: Dispatch<SetStateAction<Alert[]>>;
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
  setComissoes: Dispatch<SetStateAction<Comissao[]>>;
  setCronogramas: Dispatch<SetStateAction<CronogramaEmpenho[]>>;
}

type CollectionReadiness = Record<RealtimeOperationalCollection, boolean>;

const EMPTY_READINESS: CollectionReadiness = {
  empenhos: false,
  alerts: false,
  invoices: false,
  comissoes: false,
  cronogramas: false,
};

function mapEmpenho(snapshotDoc: QueryDocumentSnapshot<DocumentData>): Empenho {
  const data = snapshotDoc.data() as Empenho;
  return {
    ...data,
    supplier: normalizeSupplier(data.supplier),
  };
}

function mapInvoice(snapshotDoc: QueryDocumentSnapshot<DocumentData>): Invoice {
  const data = snapshotDoc.data() as Invoice;
  return {
    ...data,
    recordKey: data.recordKey || snapshotDoc.id,
    supplier: normalizeSupplier(data.supplier),
  };
}

function mapAlert(snapshotDoc: QueryDocumentSnapshot<DocumentData>): Alert {
  return snapshotDoc.data() as Alert;
}

function mapComissao(snapshotDoc: QueryDocumentSnapshot<DocumentData>): Comissao {
  return snapshotDoc.data() as Comissao;
}

function mapCronograma(snapshotDoc: QueryDocumentSnapshot<DocumentData>): CronogramaEmpenho {
  return snapshotDoc.data() as CronogramaEmpenho;
}

interface RealtimeCollectionSubscriptionInput<T> {
  collectionName: RealtimeOperationalCollection;
  enabled: boolean;
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  setData: Dispatch<SetStateAction<T[]>>;
  mapDocument: (snapshotDoc: QueryDocumentSnapshot<DocumentData>) => T;
  setCollectionReady: (collectionName: RealtimeOperationalCollection, ready: boolean) => void;
}

function useRealtimeCollectionSubscription<T>({
  collectionName,
  enabled,
  user,
  workspaceContext,
  setData,
  mapDocument,
  setCollectionReady,
}: RealtimeCollectionSubscriptionInput<T>) {
  useEffect(() => {
    setCollectionReady(collectionName, false);

    if (!enabled || !user || !isOperationalSectorContext(workspaceContext)) {
      return;
    }

    const scope = operationalScopeFromContext(workspaceContext);
    const collectionPath = getOperationalCollectionPath(scope, collectionName);

    let firstSnapshot = true;
    const stopTrackingListener = trackWorkspaceRealtimeListener(scope);
    const unsubscribe = onSnapshot(
      operationalCollectionRef(scope, collectionName),
      (snapshot) => {
        recordWorkspaceRealtimeSnapshot(
          scope,
          firstSnapshot ? snapshot.size : snapshot.docChanges().length
        );
        firstSnapshot = false;
        setData(snapshot.docs.map(mapDocument));
        setCollectionReady(collectionName, true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
        // Evita prender a interface em loading infinito. O tratamento de erro
        // permanece centralizado no Firebase e a coleção mantém o último cache.
        setCollectionReady(collectionName, true);
      }
    );

    return () => {
      unsubscribe();
      stopTrackingListener();
    };
  }, [
    collectionName,
    enabled,
    mapDocument,
    setCollectionReady,
    setData,
    user,
    workspaceContext,
  ]);
}

/**
 * Bloco 14 — mantém somente as coleções necessárias à aba atual em realtime.
 *
 * Empenhos permanece sempre ativo porque sustenta dashboard, classes, itens e
 * diversas navegações. As demais coleções são inscritas/desinscritas conforme a
 * superfície que realmente as utiliza, preservando o último snapshot em memória.
 */
export function useOperationalRealtimeCollections({
  user,
  workspaceContext,
  activeTab,
  setEmpenhos,
  setAlerts,
  setInvoices,
  setComissoes,
  setCronogramas,
}: OperationalRealtimeCollectionsInput) {
  const plan = useMemo(
    () => buildOperationalSubscriptionPlan(activeTab),
    [activeTab]
  );
  const [readiness, setReadiness] = useState<CollectionReadiness>(EMPTY_READINESS);

  const setCollectionReady = useCallback(
    (collectionName: RealtimeOperationalCollection, ready: boolean) => {
      setReadiness((current) => {
        if (current[collectionName] === ready) return current;
        return {
          ...current,
          [collectionName]: ready,
        };
      });
    },
    []
  );

  useEffect(() => {
    if (!user || !isOperationalSectorContext(workspaceContext)) {
      setReadiness(EMPTY_READINESS);
    }
  }, [user, workspaceContext]);

  useRealtimeCollectionSubscription({
    collectionName: 'empenhos',
    enabled: plan.empenhos,
    user,
    workspaceContext,
    setData: setEmpenhos,
    mapDocument: mapEmpenho,
    setCollectionReady,
  });

  useRealtimeCollectionSubscription({
    collectionName: 'alerts',
    enabled: plan.alerts,
    user,
    workspaceContext,
    setData: setAlerts,
    mapDocument: mapAlert,
    setCollectionReady,
  });

  useRealtimeCollectionSubscription({
    collectionName: 'invoices',
    enabled: plan.invoices,
    user,
    workspaceContext,
    setData: setInvoices,
    mapDocument: mapInvoice,
    setCollectionReady,
  });

  useRealtimeCollectionSubscription({
    collectionName: 'comissoes',
    enabled: plan.comissoes,
    user,
    workspaceContext,
    setData: setComissoes,
    mapDocument: mapComissao,
    setCollectionReady,
  });

  useRealtimeCollectionSubscription({
    collectionName: 'cronogramas',
    enabled: plan.cronogramas,
    user,
    workspaceContext,
    setData: setCronogramas,
    mapDocument: mapCronograma,
    setCollectionReady,
  });

  const activeOperationalDataReady = useMemo(() => {
    if (!user || !isOperationalSectorContext(workspaceContext)) return false;
    return getRequiredRealtimeCollections(activeTab)
      .every((collectionName) => readiness[collectionName]);
  }, [activeTab, readiness, user, workspaceContext]);

  return {
    activeOperationalDataReady,
    activeRealtimeCollectionCount: countRealtimeOperationalCollections(activeTab),
    readiness,
  };
}
