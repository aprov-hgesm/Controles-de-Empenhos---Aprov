'use client';

import { useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Alert, Comissao, CronogramaEmpenho, Empenho, Invoice } from '../lib/types';
import { resolveAuthenticatedWorkspaceContext } from '../lib/platformAccess';
import {
  clearResolvedWorkspaceContext,
  isOperationalSectorContext,
  resolveWorkspaceContext,
  type ResolvedWorkspaceContext,
} from '../lib/workspaceContext';
import {
  getOperationalCollectionPath,
  operationalCollectionRef,
  operationalScopeFromContext,
} from '../lib/operationalPaths';
import { resetActiveProfileMode, setActiveProfileMode } from '../lib/profileMode';
import { normalizeSupplier } from '../features/empenhos/domain/empenhoHelpers';
import { normalizePlatformEmail } from '../lib/platformIdentity';

/**
 * Fonte de verdade da sessão e das coleções operacionais em tempo real.
 *
 * Bloco 15: nenhuma subscription operacional é aberta apenas porque existe uma
 * sessão Firebase. Primeiro a conta autenticada é resolvida no diretório da
 * plataforma e associada ao workspace autorizado. Contas desconhecidas,
 * desativadas ou com workspace inválido são encerradas em fail-closed.
 */
export function useOperationalData() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [workspaceContext, setWorkspaceContext] = useState<ResolvedWorkspaceContext>(
    () => resolveWorkspaceContext(null)
  );
  const [empenhos, setEmpenhos] = useState<Empenho[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [cronogramas, setCronogramas] = useState<CronogramaEmpenho[]>([]);

  const clearOperationalState = () => {
    setEmpenhos([]);
    setAlerts([]);
    setInvoices([]);
    setComissoes([]);
    setCronogramas([]);
  };

  useEffect(() => {
    localStorage.removeItem('local_user_session');
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      void (async () => {
        if (!active) return;
        setLoadingAuth(true);

        if (!currentUser) {
          clearResolvedWorkspaceContext();
          clearOperationalState();
          setUser(null);
          setWorkspaceContext(resolveWorkspaceContext(null));
          setSyncing(false);
          setLoadingAuth(false);
          return;
        }

        setUser(currentUser);
        const resolvedContext = await resolveAuthenticatedWorkspaceContext(currentUser);
        if (!active) return;

        if (resolvedContext.status === 'unauthorized' || resolvedContext.status === 'anonymous') {
          clearResolvedWorkspaceContext();
          clearOperationalState();
          resetActiveProfileMode();
          await signOut(auth);
          if (!active) return;
          setUser(null);
          setWorkspaceContext(resolveWorkspaceContext(null));
          setSyncing(false);
          setLoadingAuth(false);
          return;
        }

        setWorkspaceContext(resolvedContext);
        setLoadingAuth(false);
      })();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user && workspaceContext.status === 'platformAdmin') {
      clearOperationalState();
      router.replace('/admin');
    }
  }, [router, user, workspaceContext.status]);

  // Bloco 19 — observador de ciclo de vida para setores externos.
  // As Rules já bloqueiam operações quando status deixa de ser active; este watcher
  // também encerra a sessão aberta assim que o diretório administrativo mudar.
  useEffect(() => {
    if (
      !user
      || !isOperationalSectorContext(workspaceContext)
      || workspaceContext.resolutionSource !== 'platform-directory'
    ) {
      return;
    }

    let revoked = false;

    const revokeOperationalAccess = () => {
      if (revoked) return;
      revoked = true;
      clearResolvedWorkspaceContext();
      clearOperationalState();
      resetActiveProfileMode();
      setWorkspaceContext(resolveWorkspaceContext(null));
      setUser(null);
      setSyncing(false);
      void signOut(auth);
    };

    const handleLifecycleError = (error: unknown) => {
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      if (code.includes('permission-denied')) {
        revokeOperationalAccess();
      }
    };

    const workspaceRef = doc(db, 'workspaces', workspaceContext.workspaceId);
    const accountRef = doc(db, 'platformAccounts', workspaceContext.email);

    const unsubscribeWorkspace = onSnapshot(
      workspaceRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          revokeOperationalAccess();
          return;
        }
        const data = snapshot.data() as { id?: string; status?: string; authorizedEmail?: string };
        if (
          data.id !== workspaceContext.workspaceId
          || data.status !== 'active'
          || data.authorizedEmail !== workspaceContext.email
        ) {
          revokeOperationalAccess();
        }
      },
      handleLifecycleError
    );

    const unsubscribeAccount = onSnapshot(
      accountRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          revokeOperationalAccess();
          return;
        }
        const data = snapshot.data() as {
          email?: string;
          workspaceId?: string;
          accountType?: string;
          status?: string;
          firebaseUid?: string;
        };
        if (
          data.email !== workspaceContext.email
          || data.workspaceId !== workspaceContext.workspaceId
          || data.accountType !== 'sector'
          || data.status !== 'active'
          || data.firebaseUid !== user.uid
        ) {
          revokeOperationalAccess();
        }
      },
      handleLifecycleError
    );

    return () => {
      unsubscribeWorkspace();
      unsubscribeAccount();
    };
  }, [user, workspaceContext]);

  useEffect(() => {
    if (!user || !isOperationalSectorContext(workspaceContext)) {
      clearOperationalState();
      setSyncing(false);
      return;
    }

    const scope = operationalScopeFromContext(workspaceContext);
    setSyncing(true);

    const empenhosPath = getOperationalCollectionPath(scope, 'empenhos');
    const alertsPath = getOperationalCollectionPath(scope, 'alerts');
    const invoicesPath = getOperationalCollectionPath(scope, 'invoices');
    const comissoesPath = getOperationalCollectionPath(scope, 'comissoes');
    const cronogramasPath = getOperationalCollectionPath(scope, 'cronogramas');

    const unsubscribeEmpenhos = onSnapshot(
      operationalCollectionRef(scope, 'empenhos'),
      (snapshot) => {
        const fetched = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Empenho;
          return {
            ...data,
            recordKey: data.recordKey || snapshotDoc.id,
            supplier: normalizeSupplier(data.supplier),
          };
        });
        setEmpenhos(fetched);
        setSyncing(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, empenhosPath);
        setSyncing(false);
      }
    );

    const unsubscribeAlerts = onSnapshot(
      operationalCollectionRef(scope, 'alerts'),
      (snapshot) => setAlerts(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as Alert)),
      (error) => handleFirestoreError(error, OperationType.LIST, alertsPath)
    );

    const unsubscribeInvoices = onSnapshot(
      operationalCollectionRef(scope, 'invoices'),
      (snapshot) => {
        const fetched = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Invoice;
          return { ...data, supplier: normalizeSupplier(data.supplier) };
        });
        setInvoices(fetched);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, invoicesPath)
    );

    const unsubscribeComissoes = onSnapshot(
      operationalCollectionRef(scope, 'comissoes'),
      (snapshot) => setComissoes(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as Comissao)),
      (error) => handleFirestoreError(error, OperationType.LIST, comissoesPath)
    );

    const unsubscribeCronogramas = onSnapshot(
      operationalCollectionRef(scope, 'cronogramas'),
      (snapshot) => setCronogramas(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as CronogramaEmpenho)),
      (error) => handleFirestoreError(error, OperationType.LIST, cronogramasPath)
    );

    return () => {
      unsubscribeEmpenhos();
      unsubscribeAlerts();
      unsubscribeInvoices();
      unsubscribeComissoes();
      unsubscribeCronogramas();
    };
  }, [user, workspaceContext]);

  const finalizeSignIn = async (authenticatedUser: User) => {
    setActiveProfileMode('sector');
    const resolvedContext = await resolveAuthenticatedWorkspaceContext(
      authenticatedUser,
      'sector'
    );

    if (resolvedContext.status === 'unauthorized' || resolvedContext.status === 'anonymous') {
      const diagnosticCode = (
        typeof resolvedContext === 'object'
        && resolvedContext
        && 'diagnosticCode' in resolvedContext
      )
        ? String((resolvedContext as { diagnosticCode?: unknown }).diagnosticCode || '')
        : '';

      clearResolvedWorkspaceContext();
      await signOut(auth);
      resetActiveProfileMode();
      setUser(null);
      setWorkspaceContext(resolveWorkspaceContext(null));
      clearOperationalState();

      if (diagnosticCode) {
        throw new Error(`Falha de autorização do workspace [${diagnosticCode}].`);
      }

      throw new Error('Não foi possível autorizar esta identidade no EMPROVEX.');
    }

    setUser(authenticatedUser);
    setWorkspaceContext(resolvedContext);
    return resolvedContext;
  };

  const signInUser = async () => {
    setSyncing(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithPopup(auth, googleProvider);
      return await finalizeSignIn(credential.user);
    } finally {
      setSyncing(false);
    }
  };

  const signInSectorUser = async (email: string, password: string) => {
    const normalizedEmail = normalizePlatformEmail(email);

    if (!normalizedEmail || !password) {
      throw new Error('Informe o e-mail e a senha de acesso.');
    }

    let firebaseCredentialAccepted = false;

    setSyncing(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      firebaseCredentialAccepted = true;
      return await finalizeSignIn(credential.user);
    } catch (error) {
      clearResolvedWorkspaceContext();
      clearOperationalState();
      resetActiveProfileMode();

      if (auth.currentUser) {
        await signOut(auth).catch(() => undefined);
      }

      setUser(null);
      setWorkspaceContext(resolveWorkspaceContext(null));

      if (error instanceof Error && error.message === 'Informe o e-mail e a senha de acesso.') {
        throw error;
      }

      const authCode = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

      if (authCode.includes('operation-not-allowed')) {
        throw new Error('O login por e-mail e senha ainda não está habilitado no Firebase Authentication.');
      }

      if (authCode.includes('too-many-requests')) {
        throw new Error('Muitas tentativas de acesso. Aguarde um pouco antes de tentar novamente.');
      }

      if (authCode.includes('network-request-failed')) {
        throw new Error('Não foi possível conectar ao serviço de autenticação. Verifique a conexão e tente novamente.');
      }

      if (authCode.includes('user-disabled')) {
        throw new Error('Esta credencial está desativada no Firebase Authentication.');
      }

      if (
        firebaseCredentialAccepted
        && error instanceof Error
        && error.message.startsWith('Falha de autorização do workspace [')
      ) {
        throw error;
      }

      if (firebaseCredentialAccepted) {
        throw new Error('A credencial foi aceita pelo Firebase, mas o vínculo com o workspace foi recusado.');
      }

      throw new Error('O Firebase rejeitou o e-mail ou a senha informados.');
    } finally {
      setSyncing(false);
    }
  };

  const signOutUser = async () => {
    localStorage.removeItem('local_user_session');
    resetActiveProfileMode();
    clearResolvedWorkspaceContext();
    await signOut(auth);
    setUser(null);
    setWorkspaceContext(resolveWorkspaceContext(null));
    clearOperationalState();
  };

  const getBalanceByClass = (classification: string) => {
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
    signInUser, signInSectorUser, signOutUser,
    getBalanceByClass,
    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,
    formatDateTime, formatDateOnly,
  };
}
