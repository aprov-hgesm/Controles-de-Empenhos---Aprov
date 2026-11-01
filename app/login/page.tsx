'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { usePlatformBranding } from '../../hooks/usePlatformBranding';
import { useOperationalViewState } from '../../hooks/useOperationalViewState';
import { useOperationalData } from '../../hooks/useOperationalData';
import { AppBackground } from '../../components/layout/AppBackground';
import { AppHeader } from '../../components/layout/AppHeader';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { ToastNotification } from '../../components/layout/ToastNotification';
import { OperationalSurfaceTransition } from '../../components/layout/OperationalSurfaceTransition';
import { OperationalSurfaceLoading } from '../../components/layout/OperationalSurfaceLoading';
import { useVisualMode } from '../../components/visual-mode/VisualModeProvider';
import { MobileNavigation } from '../../components/layout/MobileNavigation';
import { EmprovexLogin } from '../../components/auth/EmprovexLogin';
import { EmprovexAuthLoading } from '../../components/auth/EmprovexAuthLoading';
import { LoginSuccessTransition } from '../../components/auth/LoginSuccessTransition';
import { SectorCredentialModal } from '../../components/auth/SectorCredentialModal';
import { SectorFirstAccessChecklist } from '../../components/auth/SectorFirstAccessChecklist';
import { LegalAcceptanceGate } from '../../components/legal/LegalAcceptanceGate';
import type { OperationalActiveTab } from '../../lib/operationalSubscriptionPlan';
import { countPendingNotices } from '../../features/avisos/domain/noticeLifecycle';
import { canAccessWarehouseModule } from '../../lib/platformModuleAccess';
import { sectorEntryPath } from '../../lib/platformIdentity';
import { checkSectorBillingAccess, showBillingRequired } from '../../lib/sectorBillingGate';

const InicioView = lazy(() =>
  import('../../features/inicio/components/InicioView').then((module) => ({
    default: module.InicioView,
  }))
);

const OperationalDashboardEntry = lazy(() =>
  import('../../features/operational/components/OperationalDashboardEntry').then((module) => ({
    default: module.OperationalDashboardEntry,
  }))
);

const OperationalWorkspace = lazy(() =>
  import('../../features/operational/components/OperationalWorkspace').then((module) => ({
    default: module.OperationalWorkspace,
  }))
);

const EmprovexHelpOverlay = lazy(() =>
  import('../../features/support/EmprovexHelpOverlay').then(module => ({
    default: module.EmprovexHelpOverlay,
  }))
);

const EleonorExperience = lazy(() =>
  import('../../features/eleonor/components/EleonorExperience').then((module) => ({
    default: module.EleonorExperience,
  }))
);

export default function Home() {
  const { mode, hydrated: visualModeReady, clear: clearVisualMode } = useVisualMode();
  // Toast / Notifications helper
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [billingAccessState, setBillingAccessState] = useState<'checking' | 'allowed'>('checking');
  // A decisão anterior de assinatura nunca autoriza outra identidade/UG
  // nem durante o render anterior à nova verificação assíncrona.
  const [billingAccessIdentity, setBillingAccessIdentity] = useState<string | null>(null);
  const [showLoginSuccessTransition, setShowLoginSuccessTransition] = useState(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [acceptedLegalIdentityKey, setAcceptedLegalIdentityKey] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Navigation drives the realtime subscription profile (Block 14).
  const [requestedTab, setRequestedTab] = useState<OperationalActiveTab>('inicio');
  const activeTab: OperationalActiveTab =
    mode === 'essencial' && requestedTab === 'inicio' ? 'painel' : requestedTab;
  const setActiveTab: Dispatch<SetStateAction<OperationalActiveTab>> = useCallback((update) => {
    setRequestedTab((previous) => {
      const requested = typeof update === 'function' ? update(previous) : update;
      return mode === 'essencial' && requested === 'inicio' ? 'painel' : requested;
    });
  }, [mode]);
  useEffect(() => {
    if (visualModeReady && mode === 'essencial' && requestedTab === 'inicio') {
      setRequestedTab('painel');
    }
  }, [mode, requestedTab, visualModeReady]);

  // Navegação entre módulos: /central-empenhos?tab=cronogramas ativa a aba correta.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'cronogramas') setActiveTab('cronogramas');
    if (tab === 'eleonor') setActiveTab('eleonor');
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hasOpenedOperationalSurface, setHasOpenedOperationalSurface] = useState(false);
  // Ao entrar pela primeira vez numa tela transacional, preservar os hooks
  // e os callbacks desse módulo montados mesmo ao retornar para o Painel.
  const [hasOpenedTransactionalSurface, setHasOpenedTransactionalSurface] = useState(false);

  const operationalData = useOperationalData(activeTab, acceptedLegalIdentityKey, billingAccessState === 'allowed', billingAccessIdentity);
  const {
    user, loadingAuth, syncing, workspaceContext, legalIdentityKey,
    activeOperationalDataReady, activeRealtimeCollectionCount, inicioSnapshot,
    empenhos, setEmpenhos, alerts, setAlerts, invoices, setInvoices,
    comissoes, setComissoes, cronogramas, setCronogramas,
    signInUser, signInSectorUser, requestSectorPasswordReset,
    changeSectorPassword, signOutUser,
    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,
    formatDateTime, formatDateOnly
  } = operationalData;

  // Identidade e modalidade resolvidas pela conta autenticada, não pela UG.
  const resolvedEntryPath = workspaceContext.status === 'platformAdmin'
    ? '/admin'
    : workspaceContext.status === 'sector'
      ? sectorEntryPath(workspaceContext.sectorType)
      : null;
  useEffect(() => {
    if (loadingAuth || !user || !resolvedEntryPath) return;
    if (window.location.pathname !== resolvedEntryPath) {
      window.location.replace(resolvedEntryPath);
    }
  }, [loadingAuth, user, resolvedEntryPath]);

  const currentBillingIdentity = user && !loadingAuth
    ? user.uid + ':' + (workspaceContext.status === 'sector'
        ? workspaceContext.workspaceId + ':' + (workspaceContext.ug ?? '')
        : workspaceContext.status)
    : null;
  const billingIdentityAllowed = billingAccessState === 'allowed'
    && currentBillingIdentity !== null
    && billingAccessIdentity === currentBillingIdentity;

  useEffect(() => {
    let active = true;
    if (!user || loadingAuth) {
      setBillingAccessIdentity(null);
      setBillingAccessState('checking');
      return () => { active = false; };
    }
    if (workspaceContext.status !== 'sector') {
      setBillingAccessIdentity(currentBillingIdentity);
      setBillingAccessState('allowed');
      return () => { active = false; };
    }
    setBillingAccessIdentity(null);
    setBillingAccessState('checking');
    void checkSectorBillingAccess(user, workspaceContext)
      .then((decision) => {
        if (!active) return;
        if (!decision.allowed) { showBillingRequired(); return; }
        setBillingAccessIdentity(currentBillingIdentity);
        setBillingAccessState('allowed');
      })
      .catch(() => {
        if (active) showBillingRequired();
      });
    return () => { active = false; };
  }, [user, loadingAuth, currentBillingIdentity, workspaceContext.status, workspaceContext.status === 'sector' ? workspaceContext.workspaceId : null]);

  const isExternalSectorUser = (
    workspaceContext.status === 'sector'
    && workspaceContext.resolutionSource === 'platform-directory'
  );

  const handleLegalAccepted = useCallback(() => {
    if (legalIdentityKey) {
      setAcceptedLegalIdentityKey(legalIdentityKey);
    }
  }, [legalIdentityKey]);

  const handleChangeSectorPassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (changingPassword) return;

    setChangingPassword(true);
    try {
      await changeSectorPassword(currentPassword, newPassword);
      showToast('Senha alterada com sucesso.', 'success');
    } catch (error) {
      throw error;
    } finally {
      setChangingPassword(false);
    }
  };

  const { customLogo } = usePlatformBranding();

  // State for inline editing of Número da NS in Empenho Report
  const [editingNSId, setEditingNSId] = useState<string | null>(null);
  const [tempNSValue, setTempNSValue] = useState<string>('');

  const viewState = useOperationalViewState();
  const {
    selectedEmpenhoDetailId,
    setSelectedEmpenhoDetailId,
    selectedNFCommitmentId,
    nfQuantities,
    setNfQuantities,
    clearNfPdfDrafts,
  } = viewState;

  const pendingNoticeCount =
    activeTab === 'empenhos' || activeTab === 'nova_nf' || activeTab === 'avisos'
      ? countPendingNotices(alerts)
      : inicioSnapshot?.alerts.total ?? null;

  useEffect(() => {
    if (activeTab !== 'inicio') {
      setHasOpenedOperationalSurface(true);
    }
    if (activeTab !== 'inicio' && activeTab !== 'painel' && activeTab !== 'eleonor') {
      setHasOpenedTransactionalSurface(true);
    }
  }, [activeTab]);

  // Draft de quantidades por NE. Snapshot, troca de modo e re-render NAO
  // reinicializam o que foi digitado; apenas troca explicita de NE restaura draft.
  const nfDraftsByEmpenhoRef = useRef<Map<string, Record<string, number>>>(new Map());
  const lastNfCommitmentRef = useRef(selectedNFCommitmentId);
  useEffect(() => {
    nfDraftsByEmpenhoRef.current.set(lastNfCommitmentRef.current, nfQuantities);
  }, [nfQuantities]);
  useEffect(() => {
    if (lastNfCommitmentRef.current === selectedNFCommitmentId) return;
    lastNfCommitmentRef.current = selectedNFCommitmentId;
    setNfQuantities(nfDraftsByEmpenhoRef.current.get(selectedNFCommitmentId) ?? {});
  }, [selectedNFCommitmentId, setNfQuantities]);

  // Evita reutilizar drafts ou preferencia visual de outra identidade na aba.
  const lastIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadingAuth) return;
    const identity = currentBillingIdentity;
    if (lastIdentityRef.current && lastIdentityRef.current !== identity) {
      nfDraftsByEmpenhoRef.current.clear();
      setNfQuantities({});
      clearNfPdfDrafts();
      clearVisualMode();
    }
    lastIdentityRef.current = identity;
  }, [loadingAuth, currentBillingIdentity, clearVisualMode, setNfQuantities, clearNfPdfDrafts]);












  if (loadingAuth || !visualModeReady) {
    return <EmprovexAuthLoading hasAuthenticatedIdentity={Boolean(user)} />;
  }

  if (!user) {
    const handleSectorLogin = async (email: string, password: string) => {
      if (isSigningIn) return false;

      setIsSigningIn(true);
      try {
        const resolvedContext = await signInSectorUser(email, password);
        showToast('Acesso autorizado com sucesso!', 'success');
        if (resolvedContext.status === 'sector') {
          setShowLoginSuccessTransition(true);
        }
        return true;
      } catch (error) {
        console.error('Erro na autenticação do setor:', error);
        showToast(
          error instanceof Error
            ? error.message
            : 'Não foi possível entrar no EMPROVEX.',
          'error'
        );
        return false;
      } finally {
        setIsSigningIn(false);
      }
    };

    const handleFounderLogin = async () => {
      if (isSigningIn) return;

      setIsSigningIn(true);
      try {
        const resolvedContext = await signInUser();
        showToast('Acesso institucional autorizado!', 'success');
        if (resolvedContext.status === 'sector') {
          setShowLoginSuccessTransition(true);
        }
      } catch (error) {
        console.error('Erro na autenticação institucional:', error);
        showToast('Falha no acesso institucional com Google.', 'error');
      } finally {
        setIsSigningIn(false);
      }
    };

    return (
      <EmprovexLogin
        customLogo={customLogo}
        isSigningIn={isSigningIn}
        toast={toast}
        onCloseToast={() => setToast(null)}
        onSectorLogin={handleSectorLogin}
        onRequestPasswordReset={requestSectorPasswordReset}
        onFounderLogin={handleFounderLogin}
      />
    );
  }

  if (
    workspaceContext.status !== 'sector'
    || resolvedEntryPath !== '/central-empenhos'
    || (typeof window !== 'undefined' && window.location.pathname !== resolvedEntryPath)
  ) {
    return <EmprovexAuthLoading hasAuthenticatedIdentity />;
  }

  // No operational surface may render before a server billing decision.
  if (!billingIdentityAllowed) {
    return <EmprovexAuthLoading hasAuthenticatedIdentity />;
  }

  const operationalSurface = (
    <div
      className={`min-h-screen ${activeTab === 'inicio' ? 'bg-[#02040b] text-white' : 'bg-gradient-to-br from-[#f0f4f8] via-[#e8ecf3] to-[#f4f6fa] text-[#0b1c30]'} flex flex-col antialiased relative overflow-x-hidden selection:bg-blue-500 selection:text-white ${showLoginSuccessTransition ? 'emprovex-app-login-entry' : ''}`}
      data-login-entry={showLoginSuccessTransition ? 'true' : 'false'}
      data-active-realtime-collections={activeRealtimeCollectionCount}
    >

      <AppBackground immersive={activeTab === 'inicio'} essential={mode === 'essencial'} />

      {showLoginSuccessTransition && workspaceContext.status === 'sector' && (
        <LoginSuccessTransition
          customLogo={customLogo}
          onComplete={() => setShowLoginSuccessTransition(false)}
        />
      )}

      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      {isExternalSectorUser && user && workspaceContext.status === 'sector' && (
        <>
          <SectorCredentialModal
            open={credentialModalOpen}
            email={user.email || workspaceContext.email}
            saving={changingPassword}
            onClose={() => setCredentialModalOpen(false)}
            onChangePassword={handleChangeSectorPassword}
          />
          <SectorFirstAccessChecklist
            userUid={user.uid}
            workspaceName={workspaceContext.workspaceName}
            ug={workspaceContext.ug}
            onOpenCredentials={() => setCredentialModalOpen(true)}
          />
        </>
      )}

      <AppHeader
        customLogo={customLogo}
        syncing={syncing || !activeOperationalDataReady}
        userDisplayName={user?.displayName || (workspaceContext.status === 'sector' ? workspaceContext.workspaceName : '') || 'Operador EMPROVEX'}
        workspaceContext={workspaceContext}
        onOpenSidebar={() => setSidebarOpen(true)}
        onOpenAccount={
          isExternalSectorUser
            ? () => setCredentialModalOpen(true)
            : undefined
        }
      />

      {/* Main Framework Wrapper */}
      <div className="flex flex-1 pt-16 min-h-screen z-10 relative lg:pl-72">

        <AppSidebar
          activeTab={activeTab}
          open={sidebarOpen}
          userDisplayName={user?.displayName || (workspaceContext.status === 'sector' ? workspaceContext.workspaceName : '') || 'Operador EMPROVEX'}
          noticeCount={pendingNoticeCount}
          onClose={() => setSidebarOpen(false)}
          onOpenHelp={() => { setHelpOpen(true); setSidebarOpen(false); }}
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'empenhos') setSelectedEmpenhoDetailId(null);
            setSidebarOpen(false);
          }}
          onLogout={async () => {
            try {
              setShowLoginSuccessTransition(false);
              nfDraftsByEmpenhoRef.current.clear();
              clearNfPdfDrafts();
              clearVisualMode();
              await signOutUser();
              showToast('Você saiu do sistema.', 'info');
            } catch (err: any) {
              console.error(err);
              showToast('Erro ao sair do sistema', 'error');
            }
          }}
          warehouseModuleEnabled={canAccessWarehouseModule(workspaceContext)}
          onOpenWarehouse={() => {
            window.location.assign(
              mode === 'essencial' ? '/central-depositos/controle-de-itens' : '/central-depositos'
            );
          }}
        />

        {/* Content Container Area */}
        <main
          data-testid="operational-active-content"
          data-operational-tab={activeTab}
          className={`flex-1 w-full overflow-hidden ${activeTab === 'inicio'
            ? 'p-0 pb-20 md:pb-0 max-w-none'
            : 'lg:pl-6 pb-24 md:pb-12 pt-6 px-4 max-w-7xl mx-auto'
          }`}
        >
          {!activeOperationalDataReady && <OperationalSurfaceLoading />}

          {activeOperationalDataReady && activeTab === 'inicio' && (
            <OperationalSurfaceTransition key="inicio-surface" surfaceKey={activeTab}>
              <Suspense fallback={<OperationalSurfaceLoading />}>
              <InicioView
                snapshot={inicioSnapshot}
                userDisplayName={user?.displayName || 'Operador EMPROVEX'}
                onSelectEmpenho={(empenhoId) => {
                  setSelectedEmpenhoDetailId(empenhoId);
                  setActiveTab('empenhos');
                }}
              />
              </Suspense>
            </OperationalSurfaceTransition>
          )}

          {activeTab !== 'eleonor' && (activeTab !== 'inicio' || hasOpenedOperationalSurface) && (
            <Suspense
              key="operational-workspace"
              fallback={activeOperationalDataReady ? <OperationalSurfaceLoading /> : null}
            >
              {activeTab === 'painel' && !hasOpenedTransactionalSurface ? (
                <OperationalDashboardEntry
                  operationalData={operationalData}
                  viewState={viewState}
                  setActiveTab={setActiveTab}
                />
              ) : (activeTab !== 'inicio' || hasOpenedTransactionalSurface) ? (
              <OperationalWorkspace
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                operationalData={operationalData}
                viewState={viewState}
                editingNSId={editingNSId}
                setEditingNSId={setEditingNSId}
                tempNSValue={tempNSValue}
                setTempNSValue={setTempNSValue}
                showToast={showToast}
                surfaceReady={activeOperationalDataReady}
              />
              ) : null}
            </Suspense>
          )}
          <Suspense fallback={null}>
            <EleonorExperience
              key={`${user?.uid || 'anonymous'}:${workspaceContext.status === 'sector' ? workspaceContext.workspaceId : 'platform'}`}
              user={user}
              fullPage={activeTab === 'eleonor'}
              onOpenFull={() => {
                setActiveTab('eleonor');
                setSidebarOpen(false);
              }}
            />
          </Suspense>
        </main>
      </div>

      {helpOpen && (
        <Suspense fallback={<OperationalSurfaceLoading />}>
          <EmprovexHelpOverlay onClose={() => setHelpOpen(false)} />
        </Suspense>
      )}

      <MobileNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setSelectedEmpenhoDetailId={setSelectedEmpenhoDetailId}
      />

    </div>
  );

  if (
    workspaceContext.status === 'sector'
    && user
    && legalIdentityKey
  ) {
    return (
      <LegalAcceptanceGate
        identity={{
          workspaceId: workspaceContext.workspaceId,
          uid: user.uid,
          email: user.email || workspaceContext.email,
          ug: workspaceContext.ug,
        }}
        onAccepted={handleLegalAccepted}
      >
        {operationalSurface}
      </LegalAcceptanceGate>
    );
  }

  return operationalSurface;
}
