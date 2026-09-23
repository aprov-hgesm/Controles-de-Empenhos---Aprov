'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Alert, Comissao, CronogramaEmpenho, Empenho, Invoice } from '../lib/types';
import { resolveAuthenticatedWorkspaceContext } from '../lib/platformAccess';
import {
  clearResolvedWorkspaceContext,
  isOperationalSectorContext,
  resolveWorkspaceContext,
  type ResolvedWorkspaceContext,
} from '../lib/workspaceContext';
import type { OperationalActiveTab } from '../lib/operationalSubscriptionPlan';
import { resetActiveProfileMode, setActiveProfileMode } from '../lib/profileMode';
import { normalizePlatformEmail } from '../lib/platformIdentity';
import { flushWorkspaceUsageTelemetry } from '../lib/workspaceUsageTelemetry';
import {
  PlatformSessionLeaseError,
  SESSION_CAPACITY_EXCEEDED_MESSAGE,
  clearAllLocalWorkspaceSessionState,
  clearLocalWorkspaceSessionLease,
  releaseWorkspaceSessionLease,
} from '../lib/platformSessionLease';
import { startWorkspaceSessionControl } from '../lib/platformSessionControl';
import { useOperationalRealtimeCollections } from './useOperationalRealtimeCollections';
import { useInicioOperationalSnapshot } from '../features/inicio/hooks/useInicioOperationalSnapshot';
import { getEmpenhoExerciseYear } from '../features/empenhos/domain/empenhoExercise';

/**
 * Fonte de verdade da sessão e das coleções operacionais em tempo real.
 *
 * Bloco 15: nenhuma subscription operacional é aberta apenas porque existe uma
 * sessão Firebase. Primeiro a conta autenticada é resolvida no diretório da
 * plataforma e associada ao workspace autorizado. Contas desconhecidas,
 * desativadas ou com workspace inválido são encerradas em fail-closed.
 */
export function useOperationalData(activeTab: OperationalActiveTab) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const explicitSignInRef = useRef(false);
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

  const {
    activeOperationalDataReady: operationalCollectionsReady,
    activeRealtimeCollectionCount: operationalCollectionCount,
    readiness,
  } = useOperationalRealtimeCollections({
    user,
    workspaceContext,
    activeTab,
    setEmpenhos,
    setAlerts,
    setInvoices,
    setComissoes,
    setCronogramas,
  });

  const {
    snapshot: inicioSnapshot,
    snapshotReady: inicioSnapshotReady,
  } = useInicioOperationalSnapshot({
    user,
    workspaceContext,
    activeTab,
    empenhos,
    alerts,
    invoices,
    empenhosReady: readiness.empenhos,
    alertsReady: readiness.alerts,
    invoicesReady: readiness.invoices,
  });

  const activeOperationalDataReady =
    activeTab === 'inicio'
      ? inicioSnapshotReady
      : operationalCollectionsReady;

  const activeRealtimeCollectionCount =
    operationalCollectionCount
    + (
      activeTab === 'inicio'
      && user
      && isOperationalSectorContext(workspaceContext)
        ? 1
        : 0
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
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      void (async () => {
        if (!active) return;

        // O login explícito já resolve workspace + lease no mesmo fluxo. Ignorar
        // este eco do Auth evita duas resoluções concorrentes da mesma tentativa.
        if (currentUser && explicitSignInRef.current) return;

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
          const diagnosticCode = (
            typeof resolvedContext === 'object'
            && resolvedContext
            && 'diagnosticCode' in resolvedContext
          )
            ? String((resolvedContext as { diagnosticCode?: unknown }).diagnosticCode || '')
            : '';
          if (diagnosticCode === 'SESSION_REVOKED') {
            clearAllLocalWorkspaceSessionState();
          }
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

  const sessionControlIdentityKey = (
    user
    && isOperationalSectorContext(workspaceContext)
    && workspaceContext.resolutionSource === 'platform-directory'
  )
    ? [
        user.uid,
        normalizePlatformEmail(user.email || ''),
        workspaceContext.workspaceId,
        workspaceContext.email,
        workspaceContext.ug || '',
      ].join('|')
    : null;

  // Bloco 17.2 simplificado — cada aba protege autonomamente lifecycle e
  // revogação. A identidade lógica continua compartilhada entre abas, enquanto
  // somente o heartbeat usa um mutex curto para evitar writes redundantes.
  useEffect(() => {
    if (
      !user
      || !isOperationalSectorContext(workspaceContext)
      || workspaceContext.resolutionSource !== 'platform-directory'
    ) {
      return;
    }

    let active = true;

    const revokeLeaseAccess = () => {
      if (!active) return;
      active = false;
      clearLocalWorkspaceSessionLease(workspaceContext.workspaceId, user.uid);
      clearResolvedWorkspaceContext();
      clearOperationalState();
      resetActiveProfileMode();
      setWorkspaceContext(resolveWorkspaceContext(null));
      setUser(null);
      setSyncing(false);
      void signOut(auth);
    };

    const sessionControl = startWorkspaceSessionControl(
      user,
      workspaceContext,
      {
        onSessionInvalid: () => revokeLeaseAccess(),
        onTransientError: (error) => {
          console.warn('Falha transitória no controle de sessão EMPROVEX.', error);
        },
      }
    );

    return () => {
      active = false;
      sessionControl.stop();
    };
  }, [sessionControlIdentityKey]);

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

      if (diagnosticCode === 'SESSION_REVOKED') {
        clearAllLocalWorkspaceSessionState();
        throw new PlatformSessionLeaseError(
          'SESSION_REVOKED',
          'Esta sessão foi encerrada pela administração. Faça login novamente.'
        );
      }

      if (diagnosticCode === 'SESSION_CAPACITY_EXCEEDED') {
        throw new PlatformSessionLeaseError(
          'SESSION_CAPACITY_EXCEEDED',
          SESSION_CAPACITY_EXCEEDED_MESSAGE
        );
      }

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
    explicitSignInRef.current = true;
    setSyncing(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithPopup(auth, googleProvider);
      return await finalizeSignIn(credential.user);
    } finally {
      explicitSignInRef.current = false;
      setSyncing(false);
    }
  };

  const signInSectorUser = async (email: string, password: string) => {
    const normalizedEmail = normalizePlatformEmail(email);

    if (!normalizedEmail || !password) {
      throw new Error('Informe o e-mail e a senha de acesso.');
    }

    let firebaseCredentialAccepted = false;

    explicitSignInRef.current = true;
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

      if (firebaseCredentialAccepted && error instanceof PlatformSessionLeaseError) {
        throw error;
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
      explicitSignInRef.current = false;
      setSyncing(false);
    }
  };

  const signOutUser = async () => {
    localStorage.removeItem('local_user_session');

    if (
      user
      && isOperationalSectorContext(workspaceContext)
      && workspaceContext.resolutionSource === 'platform-directory'
    ) {
      try {
        await releaseWorkspaceSessionLease(user, workspaceContext);
      } catch (error) {
        // Logout não fica preso por falha de rede; nesse caso o slot expira sozinho.
        console.warn('Não foi possível liberar imediatamente o lease de sessão.', error);
        clearLocalWorkspaceSessionLease(workspaceContext.workspaceId, user.uid);
      }
    }

    if (user && isOperationalSectorContext(workspaceContext)) {
      await flushWorkspaceUsageTelemetry({
        workspaceId: workspaceContext.workspaceId,
        ug: workspaceContext.ug,
      });
    }

    resetActiveProfileMode();
    clearResolvedWorkspaceContext();
    await signOut(auth);
    setUser(null);
    setWorkspaceContext(resolveWorkspaceContext(null));
    clearOperationalState();
  };

  const getBalanceByClass = useCallback((classification: string) => {
    const filtered = empenhos.filter((emp) => emp.classification === classification);
    return filtered.reduce((total, emp) => {
      const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
      return total + (totalCommitted - totalReceived);
    }, 0);
  }, [empenhos]);

  const uniquePregaos = useMemo(
    () => Array.from(new Set(empenhos.map((emp) => emp.pregao).filter(Boolean))) as string[],
    [empenhos]
  );

  const uniqueEmpenhoYears = useMemo(
    () => Array.from(new Set(
      empenhos
        .map((emp) => getEmpenhoExerciseYear(emp))
        .filter((year): year is number => Number.isFinite(year))
        .map(String)
    )).sort((a, b) => b.localeCompare(a)),
    [empenhos]
  );

  const uniqueNfMonths = useMemo(
    () => Array.from(new Set(invoices.map((inv) => (
      inv.issueDate && inv.issueDate.length >= 7 ? inv.issueDate.substring(0, 7) : ''
    )).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [invoices]
  );

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
    activeOperationalDataReady, activeRealtimeCollectionCount,
    inicioSnapshot,
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
