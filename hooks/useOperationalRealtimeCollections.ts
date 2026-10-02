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
  getDoc,
  onSnapshot,
  query,
  where,
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
  operationalSettingsDocRef,
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
  INVOICE_HOT_HISTORY_MARKER_ID,
  INVOICE_OPERATIONAL_LOCATIONS,
  isInvoiceHotHistoryMarker,
  isInvoiceOperationalRealtime,
  mergeInvoiceCollections,
} from '../lib/invoiceHotHistory';
import { loadInvoicesByRecordKeys } from '../lib/historicalInvoiceQueries';
import {
  recordWorkspaceDocumentReads,
  recordWorkspaceRealtimeSnapshot,
  trackWorkspaceRealtimeListener,
} from '../lib/workspaceUsageTelemetry';

interface OperationalRealtimeCollectionsInput {
  enabled: boolean;
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

const HOT_HISTORY_READY_WORKSPACES = new Set<string>();

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

async function isInvoiceHotHistoryReady(
  workspaceContext: ResolvedWorkspaceContext
): Promise<boolean> {
  if (!isOperationalSectorContext(workspaceContext)) return false;
  if (HOT_HISTORY_READY_WORKSPACES.has(workspaceContext.workspaceId)) return true;

  const scope = operationalScopeFromContext(workspaceContext);
  const markerRef = operationalSettingsDocRef(scope, INVOICE_HOT_HISTORY_MARKER_ID);

  try {
    const snapshot = await getDoc(markerRef);
    recordWorkspaceDocumentReads(scope, snapshot.exists() ? 1 : 0);
    if (!snapshot.exists()) return false;
    if (!isInvoiceHotHistoryMarker(snapshot.data(), scope.workspaceId)) return false;
    HOT_HISTORY_READY_WORKSPACES.add(scope.workspaceId);
    return true;
  } catch (error) {
    console.warn(
      'PERF-X: não foi possível validar o backfill de NFs; mantendo listener compatível completo.',
      error
    );
    return false;
  }
}

function useRealtimeInvoiceSubscription({
  enabled,
  user,
  workspaceContext,
  setInvoices,
  setCollectionReady,
}: {
  enabled: boolean;
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
  setCollectionReady: (collectionName: RealtimeOperationalCollection, ready: boolean) => void;
}) {
  useEffect(() => {
    setCollectionReady('invoices', false);

    if (!enabled || !user || !isOperationalSectorContext(workspaceContext)) {
      return;
    }

    const scope = operationalScopeFromContext(workspaceContext);
    const collectionPath = getOperationalCollectionPath(scope, 'invoices');
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let stopTrackingListener: (() => void) | null = null;
    let previousOperationalKeys = new Set<string>();

    void (async () => {
      const hotHistoryReady = await isInvoiceHotHistoryReady(workspaceContext);
      if (cancelled) return;

      const collectionRef = operationalCollectionRef(scope, 'invoices');
      const realtimeRef = hotHistoryReady
        ? query(
            collectionRef,
            where('localizacaoAtual', 'in', [...INVOICE_OPERATIONAL_LOCATIONS])
          )
        : collectionRef;

      let firstSnapshot = true;
      stopTrackingListener = trackWorkspaceRealtimeListener(scope);
      unsubscribe = onSnapshot(
        realtimeRef,
        (snapshot) => {
          recordWorkspaceRealtimeSnapshot(
            scope,
            firstSnapshot ? snapshot.size : snapshot.docChanges().length
          );
          firstSnapshot = false;

          const nextInvoices = snapshot.docs.map(mapInvoice);

          if (!hotHistoryReady) {
            previousOperationalKeys = new Set(
              nextInvoices.map((invoice) => invoice.recordKey || invoice.id)
            );
            setInvoices(nextInvoices);
            setCollectionReady('invoices', true);
            return;
          }

          const nextOperationalKeys = new Set(
            nextInvoices.map((invoice) => invoice.recordKey || invoice.id)
          );
          const removedKeys = [...previousOperationalKeys].filter(
            (key) => !nextOperationalKeys.has(key)
          );

          setInvoices((current) => {
            const historical = current.filter(
              (invoice) => !isInvoiceOperationalRealtime(invoice)
            );
            return mergeInvoiceCollections(nextInvoices, historical);
          });
          previousOperationalKeys = nextOperationalKeys;
          setCollectionReady('invoices', true);

          if (removedKeys.length > 0) {
            void loadInvoicesByRecordKeys(removedKeys)
              .then((refreshed) => {
                if (cancelled) return;
                const completed = refreshed.filter(
                  (invoice) => !isInvoiceOperationalRealtime(invoice)
                );
                if (completed.length === 0) return;
                setInvoices((current) => mergeInvoiceCollections(completed, current));
              })
              .catch((error) => {
                console.warn(
                  'PERF-X: não foi possível revalidar NF que saiu do conjunto operacional.',
                  error
                );
              });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, collectionPath);
          setCollectionReady('invoices', true);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      stopTrackingListener?.();
    };
  }, [
    enabled,
    setCollectionReady,
    setInvoices,
    user,
    workspaceContext,
  ]);
}

/**
 * Bloco 14 — mantém somente as coleções necessárias à aba atual em realtime.
 *
 * PERF-X mantém invoices em realtime apenas enquanto permanecem operacionais,
 * depois que o backfill legado estiver certificado. Até lá, o hook cai
 * deliberadamente no listener completo anterior para preservar compatibilidade.
 * Histórico já solicitado pelo usuário pode permanecer em memória, mas não fica
 * conectado ao listener operacional.
 */
export function useOperationalRealtimeCollections({
  enabled,
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
    if (!enabled || !user || !isOperationalSectorContext(workspaceContext)) {
      setReadiness(EMPTY_READINESS);
    }
  }, [enabled, user, workspaceContext]);

  useRealtimeCollectionSubscription({
    collectionName: 'empenhos',
    enabled: enabled && plan.empenhos,
    user,
    workspaceContext,
    setData: setEmpenhos,
    mapDocument: mapEmpenho,
    setCollectionReady,
  });

  useRealtimeCollectionSubscription({
    collectionName: 'alerts',
    enabled: enabled && plan.alerts,
    user,
    workspaceContext,
    setData: setAlerts,
    mapDocument: mapAlert,
    setCollectionReady,
  });

  useRealtimeInvoiceSubscription({
    enabled: enabled && plan.invoices,
    user,
    workspaceContext,
    setInvoices,
    setCollectionReady,
  });

  useRealtimeCollectionSubscription({
    collectionName: 'comissoes',
    enabled: enabled && plan.comissoes,
    user,
    workspaceContext,
    setData: setComissoes,
    mapDocument: mapComissao,
    setCollectionReady,
  });

  useRealtimeCollectionSubscription({
    collectionName: 'cronogramas',
    enabled: enabled && plan.cronogramas,
    user,
    workspaceContext,
    setData: setCronogramas,
    mapDocument: mapCronograma,
    setCollectionReady,
  });

  const activeOperationalDataReady = useMemo(() => {
    if (!enabled || !user || !isOperationalSectorContext(workspaceContext)) return false;
    return getRequiredRealtimeCollections(activeTab)
      .every((collectionName) => readiness[collectionName]);
  }, [activeTab, enabled, readiness, user, workspaceContext]);

  return {
    activeOperationalDataReady,
    activeRealtimeCollectionCount: enabled
      ? countRealtimeOperationalCollections(activeTab)
      : 0,
    readiness,
  };
}
