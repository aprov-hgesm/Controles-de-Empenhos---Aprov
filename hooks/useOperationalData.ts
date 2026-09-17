'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Alert, Comissao, CronogramaEmpenho, Empenho, Invoice } from '../lib/types';
import {
  isOperationalSectorContext,
  resolveWorkspaceContext,
} from '../lib/workspaceContext';
import { normalizeSupplier } from '../features/empenhos/domain/empenhoHelpers';

/**
 * Fonte de verdade da sessão e das coleções operacionais em tempo real.
 *
 * A partir do Bloco 4, nenhuma subscription operacional é aberta antes de a
 * identidade autenticada ser resolvida. Durante a transição, somente o workspace
 * fundador do HGeSM pode usar os paths globais legados.
 */
export function useOperationalData() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [empenhos, setEmpenhos] = useState<Empenho[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [cronogramas, setCronogramas] = useState<CronogramaEmpenho[]>([]);

  const workspaceContext = useMemo(
    () => resolveWorkspaceContext(user?.email),
    [user?.email]
  );

  const clearOperationalState = () => {
    setEmpenhos([]);
    setAlerts([]);
    setInvoices([]);
    setComissoes([]);
    setCronogramas([]);
  };

  useEffect(() => {
    localStorage.removeItem('local_user_session');
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && workspaceContext.status === 'platformAdmin') {
      router.replace('/admin');
    }
  }, [router, user, workspaceContext.status]);

  useEffect(() => {
    if (!user || workspaceContext.status !== 'unauthorized') return;

    clearOperationalState();
    void signOut(auth).finally(() => {
      setUser(null);
      setSyncing(false);
    });
  }, [user, workspaceContext.status]);

  useEffect(() => {
    if (
      !user ||
      !isOperationalSectorContext(workspaceContext) ||
      !workspaceContext.legacyDataMode
    ) {
      clearOperationalState();
      setSyncing(false);
      return;
    }

    setSyncing(true);

    // Compatibilidade temporária do workspace fundador: os dados do HGeSM ainda
    // residem nas coleções globais. Novos setores nunca devem reutilizar estes paths.
    const unsubscribeEmpenhos = onSnapshot(
      collection(db, 'empenhos'),
      (snapshot) => {
        const fetched = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Empenho;
          return { ...data, supplier: normalizeSupplier(data.supplier) };
        });
        setEmpenhos(fetched);
        setSyncing(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'empenhos');
        setSyncing(false);
      }
    );

    const unsubscribeAlerts = onSnapshot(
      collection(db, 'alerts'),
      (snapshot) => setAlerts(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as Alert)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'alerts')
    );

    const unsubscribeInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snapshot) => {
        const fetched = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Invoice;
          return { ...data, supplier: normalizeSupplier(data.supplier) };
        });
        setInvoices(fetched);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    const unsubscribeComissoes = onSnapshot(
      collection(db, 'comissoes'),
      (snapshot) => setComissoes(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as Comissao)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'comissoes')
    );

    const unsubscribeCronogramas = onSnapshot(
      collection(db, 'cronogramas'),
      (snapshot) => setCronogramas(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as CronogramaEmpenho)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'cronogramas')
    );

    return () => {
      unsubscribeEmpenhos();
      unsubscribeAlerts();
      unsubscribeInvoices();
      unsubscribeComissoes();
      unsubscribeCronogramas();
    };
  }, [user, workspaceContext]);

  const signInUser = async () => {
    setSyncing(true);
    try {
      // Garante que a sessão sobreviva a mudanças de rota/recarregamentos antes
      // de iniciar o popup. Isso é especialmente importante para o perfil admin,
      // que navega imediatamente para /admin após autenticar.
      await setPersistence(auth, browserLocalPersistence);

      const credential = await signInWithPopup(auth, googleProvider);
      const resolvedContext = resolveWorkspaceContext(credential.user.email);

      if (resolvedContext.status === 'unauthorized' || resolvedContext.status === 'anonymous') {
        const returnedEmail = credential.user.email || 'sem e-mail informado';
        await signOut(auth);
        throw new Error(`A conta Google ${returnedEmail} ainda não está autorizada no EMPROVEX.`);
      }

      if (resolvedContext.status === 'platformAdmin') {
        router.replace('/admin');
      }

      return resolvedContext;
    } finally {
      setSyncing(false);
    }
  };

  const signOutUser = async () => {
    localStorage.removeItem('local_user_session');
    await signOut(auth);
    setUser(null);
    clearOperationalState();
  };

  const getBalanceByClass = (classification: 'QR' | 'CALI' | 'PASA') => {
    const filtered = empenhos.filter((emp) => emp.classification === classification);
    return filtered.reduce((total, emp) => {
      const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
      return total + (totalCommitted - totalReceived);
    }, 0);
  };

  const uniquePregaos = Array.from(new Set(empenhos.map((emp) => emp.pregao).filter(Boolean))) as string[];
  const uniqueEmpenhoYears = Array.from(new Set(empenhos.map((emp) => {
    if (!emp.date) return '';
    const parts = emp.date.split('/');
    if (parts.length === 3) return parts[2];
    if (emp.date.includes('-')) return emp.date.split('-')[0];
    return '';
  }).filter(Boolean))).sort((a, b) => b.localeCompare(a)) as string[];
  const uniqueNfMonths = Array.from(new Set(invoices.map((inv) => (
    inv.issueDate && inv.issueDate.length >= 7 ? inv.issueDate.substring(0, 7) : ''
  )).filter(Boolean))).sort((a, b) => b.localeCompare(a));

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (Number.isNaN(date.getTime())) return isoString;
      return date.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '—';
    if (dateStr.includes('T')) {
      try {
        const date = new Date(dateStr);
        if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
      } catch {
        // fallback to textual parsing below
      }
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return {
    user, loadingAuth, syncing, workspaceContext,
    empenhos, setEmpenhos,
    alerts, setAlerts,
    invoices, setInvoices,
    comissoes, setComissoes,
    cronogramas, setCronogramas,
    signInUser, signOutUser,
    getBalanceByClass,
    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,
    formatDateTime, formatDateOnly,
  };
}
