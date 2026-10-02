'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
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
import { isValidPlatformEmail, normalizePlatformEmail } from '../lib/platformIdentity';
import { HGESM_SECTOR_EMAIL } from '../lib/hgesmWorkspace';
import {
  MAX_SECTOR_PASSWORD_LENGTH,
  MIN_SECTOR_PASSWORD_LENGTH,
} from '../lib/sectorProvisioning';
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

const PASSWORD_RESET_CONFIRMATION =
  'Se o e-mail estiver cadastrado para acesso por senha, você receberá as instruções de redefinição.';

class SectorAccessExperienceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SectorAccessExperienceError';
  }
}

function authErrorCode(error: unknown): string {
  return typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
}

function describeSectorAuthorizationFailure(code: string): string {
  if (
    code === 'ACCOUNT_NOT_FOUND'
    || code === 'ACCOUNT_INVALID'
    || code === 'ACCOUNT_DISABLED_OR_WRONG_TYPE'
  ) {
    return 'Esta conta não está autorizada para acessar o EMPROVEX. Se o acesso deveria estar ativo, contate a Administração EMPROVEX.';
  }

  if (code === 'WORKSPACE_DISABLED') {
    return 'O acesso deste setor está temporariamente indisponível. Contate a Administração EMPROVEX para verificar a situação do workspace.';
  }

  if (
    code === 'ACCOUNT_EMAIL_MISMATCH'
    || code === 'ACCOUNT_PROVIDER_MISMATCH'
    || code === 'SESSION_PROVIDER_MISMATCH'
    || code === 'UID_MISMATCH'
    || code === 'WORKSPACE_NOT_FOUND'
    || code === 'WORKSPACE_INVALID'
    || code === 'WORKSPACE_ID_MISMATCH'
    || code === 'WORKSPACE_EMAIL_MISMATCH'
    || code === 'UG_MISMATCH'
  ) {
    return 'Não foi possível confirmar a identidade deste setor. Contate a Administração EMPROVEX para revisar o cadastro de acesso.';
  }

  if (code.startsWith('FIRESTORE_')) {
    return 'Não foi possível validar o acesso agora. Verifique sua conexão e tente novamente.';
  }

  return 'Não foi possível concluir a validação do acesso. Tente novamente e, se o problema persistir, contate a Administração EMPROVEX.';
}

/**
 * Fonte de verdade da sessão e das coleções operacionais em tempo real.
 *
 * Bloco 15: nenhuma subscription operacional é aberta apenas porque existe uma
 * sessão Firebase. Primeiro a conta autenticada é resolvida no diretório da
 * plataforma e associada ao workspace autorizado. Contas desconhecidas,
 * desativadas ou com workspace inválido são encerradas em fail-closed.
 */
export function useOperationalData(
  activeTab: OperationalActiveTab,
  acceptedLegalIdentityKey: string | null = null
) {
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

  const legalIdentityKey = (
    user
    && isOperationalSectorContext(workspaceContext)
  )
    ? [
        user.uid,
        normalizePlatformEmail(user.email || workspaceContext.email),
        workspaceContext.workspaceId,
        workspaceContext.ug || '',
      ].join('|')
    : null;
  const operationalAccessEnabled = Boolean(
    legalIdentityKey
    && acceptedLegalIdentityKey === legalIdentityKey
  );

  const {
    activeOperationalDataReady: operationalCollectionsReady,
    activeRealtimeCollectionCount: operationalCollectionCount,
    readiness,
  } = useOperationalRealtimeCollections({
    enabled: operationalAccessEnabled,
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
    enabled: operationalAccessEnabled,
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
      && operationalAccessEnabled
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
        throw new SectorAccessExperienceError(
          describeSectorAuthorizationFailure(diagnosticCode)
        );
      }

      throw new SectorAccessExperienceError(
        'Não foi possível autorizar esta conta no EMPROVEX.'
      );
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
      const credential = process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1'
        ? await signInWithCredential(
            auth,
            GoogleAuthProvider.credential(
              JSON.stringify({
                sub: 'google-admin-google',
                email: 'aprov1hgesm@gmail.com',
                email_verified: true,
              })
            )
          )
        : await signInWithPopup(auth, googleProvider);
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

      if (!credential.user.emailVerified) {
        throw new SectorAccessExperienceError(
          'O e-mail desta credencial ainda não está verificado. Contate a Administração EMPROVEX para confirmar o cadastro.'
        );
      }

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

      const authCode = authErrorCode(error);

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
        throw new Error(
          'Esta conta está temporariamente indisponível. Contate a Administração EMPROVEX para verificar o acesso.'
        );
      }

      if (firebaseCredentialAccepted && error instanceof PlatformSessionLeaseError) {
        throw error;
      }

      if (firebaseCredentialAccepted && error instanceof SectorAccessExperienceError) {
        throw error;
      }

      if (firebaseCredentialAccepted) {
        throw new Error(
          'A credencial foi aceita, mas não foi possível concluir a autorização do setor. Contate a Administração EMPROVEX.'
        );
      }

      throw new Error('E-mail ou senha inválidos.');
    } finally {
      explicitSignInRef.current = false;
      setSyncing(false);
    }
  };

  const requestSectorPasswordReset = async (email: string) => {
    const normalizedEmail = normalizePlatformEmail(email);

    if (!isValidPlatformEmail(normalizedEmail)) {
      throw new Error('Informe um e-mail válido para receber as instruções de redefinição.');
    }

    // A conta fundadora permanece Google-only. A resposta é deliberadamente
    // indistinguível para não expor a existência ou o tipo de uma conta.
    if (normalizedEmail === HGESM_SECTOR_EMAIL) {
      return PASSWORD_RESET_CONFIRMATION;
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      return PASSWORD_RESET_CONFIRMATION;
    } catch (error) {
      const code = authErrorCode(error);

      // Com ou sem Email Enumeration Protection, nunca confirmar se a conta existe.
      if (
        code.includes('user-not-found')
        || code.includes('invalid-credential')
        || code.includes('invalid-login-credentials')
      ) {
        return PASSWORD_RESET_CONFIRMATION;
      }

      if (code.includes('invalid-email')) {
        throw new Error('Informe um e-mail válido para receber as instruções de redefinição.');
      }

      if (code.includes('too-many-requests')) {
        throw new Error('Muitas solicitações de redefinição foram feitas. Tente novamente mais tarde.');
      }

      if (code.includes('network-request-failed')) {
        throw new Error('Não foi possível solicitar a redefinição agora. Verifique sua conexão e tente novamente.');
      }

      throw new Error('Não foi possível solicitar a redefinição agora. Tente novamente mais tarde.');
    }
  };

  const changeSectorPassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    const currentUser = auth.currentUser;
    const normalizedEmail = normalizePlatformEmail(currentUser?.email || '');

    if (!currentUser || !isValidPlatformEmail(normalizedEmail)) {
      throw new Error('Sua sessão de acesso não está disponível. Entre novamente e tente de novo.');
    }

    if (
      newPassword.length < MIN_SECTOR_PASSWORD_LENGTH
      || newPassword.length > MAX_SECTOR_PASSWORD_LENGTH
    ) {
      throw new Error(
        `A nova senha deve possuir entre ${MIN_SECTOR_PASSWORD_LENGTH} e ${MAX_SECTOR_PASSWORD_LENGTH} caracteres.`
      );
    }

    if (!currentPassword) {
      throw new Error('Informe sua senha atual para confirmar a alteração.');
    }

    if (currentPassword === newPassword) {
      throw new Error('Escolha uma nova senha diferente da senha atual.');
    }

    const tokenResult = await currentUser.getIdTokenResult();
    if (
      normalizedEmail === HGESM_SECTOR_EMAIL
      || tokenResult.signInProvider !== 'password'
    ) {
      throw new Error('Esta conta utiliza acesso institucional pelo Google e não possui senha do EMPROVEX para alterar.');
    }

    try {
      const credential = EmailAuthProvider.credential(
        normalizedEmail,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
    } catch (error) {
      const code = authErrorCode(error);

      if (
        code.includes('wrong-password')
        || code.includes('invalid-credential')
        || code.includes('invalid-login-credentials')
      ) {
        throw new Error('A senha atual informada não confere.');
      }

      if (code.includes('weak-password')) {
        throw new Error('A nova senha não atende aos requisitos de segurança configurados.');
      }

      if (code.includes('too-many-requests')) {
        throw new Error('Muitas tentativas foram feitas. Aguarde um pouco antes de tentar novamente.');
      }

      if (code.includes('network-request-failed')) {
        throw new Error('Não foi possível alterar a senha agora. Verifique sua conexão e tente novamente.');
      }

      if (code.includes('requires-recent-login')) {
        throw new Error('Sua sessão precisa ser renovada. Saia, entre novamente e repita a alteração de senha.');
      }

      throw new Error('Não foi possível alterar a senha agora. Tente novamente.');
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
    legalIdentityKey,
    activeOperationalDataReady, activeRealtimeCollectionCount,
    inicioSnapshot,
    empenhos, setEmpenhos,
    alerts, setAlerts,
    invoices, setInvoices,
    comissoes, setComissoes,
    cronogramas, setCronogramas,
    signInUser, signInSectorUser, requestSectorPasswordReset,
    changeSectorPassword, signOutUser,
    getBalanceByClass,
    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,
    formatDateTime, formatDateOnly,
  };
}
