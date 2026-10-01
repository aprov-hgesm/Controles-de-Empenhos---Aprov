'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { usePlatformBranding } from '../hooks/usePlatformBranding';
import { useOperationalViewState } from '../hooks/useOperationalViewState';
import { useOperationalData } from '../hooks/useOperationalData';
import { AppBackground } from '../components/layout/AppBackground';
import { AppHeader } from '../components/layout/AppHeader';
import { AppSidebar } from '../components/layout/AppSidebar';
import { ToastNotification } from '../components/layout/ToastNotification';
import { OperationalSurfaceTransition } from '../components/layout/OperationalSurfaceTransition';
import { OperationalSurfaceLoading } from '../components/layout/OperationalSurfaceLoading';
import { InicioView } from '../features/inicio/components/InicioView';
import { MobileNavigation } from '../components/layout/MobileNavigation';
import { EmprovexLogin } from '../components/auth/EmprovexLogin';
import { EmprovexAuthLoading } from '../components/auth/EmprovexAuthLoading';
import { LoginSuccessTransition } from '../components/auth/LoginSuccessTransition';
import type { OperationalActiveTab } from '../lib/operationalSubscriptionPlan';
import { countPendingNotices } from '../features/avisos/domain/noticeLifecycle';
import { canAccessWarehouseModule } from '../lib/platformModuleAccess';

const OperationalWorkspace = lazy(() =>
  import('../features/operational/components/OperationalWorkspace').then((module) => ({
    default: module.OperationalWorkspace,
  }))
);

export default function Home() {
  // Toast / Notifications helper
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showLoginSuccessTransition, setShowLoginSuccessTransition] = useState(false);
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
  const [activeTab, setActiveTab] = useState<OperationalActiveTab>('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasOpenedOperationalSurface, setHasOpenedOperationalSurface] = useState(false);

  const operationalData = useOperationalData(activeTab);
  const {
    user, loadingAuth, syncing, workspaceContext,
    activeOperationalDataReady, activeRealtimeCollectionCount, inicioSnapshot,
    empenhos, setEmpenhos, alerts, setAlerts, invoices, setInvoices,
    comissoes, setComissoes, cronogramas, setCronogramas,
    signInUser, signInSectorUser, signOutUser,
    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,
    formatDateTime, formatDateOnly
  } = operationalData;

  const { customLogo } = usePlatformBranding();

  // State for inline editing of Número da NS in Empenho Report
  const [editingNSId, setEditingNSId] = useState<string | null>(null);
  const [tempNSValue, setTempNSValue] = useState<string>('');

  const viewState = useOperationalViewState();
  const {
    selectedEmpenhoDetailId,
    setSelectedEmpenhoDetailId,
    selectedNFCommitmentId,
    setNfQuantities,
  } = viewState;

  const pendingNoticeCount =
    activeTab === 'empenhos' || activeTab === 'nova_nf' || activeTab === 'avisos'
      ? countPendingNotices(alerts)
      : inicioSnapshot?.alerts.total ?? 0;

  useEffect(() => {
    if (activeTab !== 'inicio') {
      setHasOpenedOperationalSurface(true);
    }
  }, [activeTab]);

  // Reset NF inputs when changing target empenho
  useEffect(() => {
    const target = empenhos.find(e => e.id === selectedNFCommitmentId);
    if (target) {
      const initialQtys: { [itemId: string]: number } = {};
      target.items.forEach(item => {
        initialQtys[item.id] = 0;
      });
      setNfQuantities(initialQtys);
    }
  }, [selectedNFCommitmentId, empenhos]);












  if (loadingAuth) {
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
        onFounderLogin={handleFounderLogin}
      />
    );
  }

  return (
    <div
      className={`min-h-screen ${activeTab === 'inicio' ? 'bg-[#02040b] text-white' : 'bg-gradient-to-br from-[#f0f4f8] via-[#e8ecf3] to-[#f4f6fa] text-[#0b1c30]'} flex flex-col antialiased relative overflow-x-hidden selection:bg-blue-500 selection:text-white ${showLoginSuccessTransition ? 'emprovex-app-login-entry' : ''}`}
      data-login-entry={showLoginSuccessTransition ? 'true' : 'false'}
      data-active-realtime-collections={activeRealtimeCollectionCount}
    >

      <AppBackground immersive={activeTab === 'inicio'} />

      {showLoginSuccessTransition && workspaceContext.status === 'sector' && (
        <LoginSuccessTransition
          customLogo={customLogo}
          onComplete={() => setShowLoginSuccessTransition(false)}
        />
      )}

      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      <AppHeader
        customLogo={customLogo}
        syncing={syncing || !activeOperationalDataReady}
        userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}
        workspaceContext={workspaceContext}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Main Framework Wrapper */}
      <div className="flex flex-1 pt-16 min-h-screen z-10 relative lg:pl-72">

        <AppSidebar
          activeTab={activeTab}
          open={sidebarOpen}
          userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}
          noticeCount={pendingNoticeCount}
          onClose={() => setSidebarOpen(false)}
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'empenhos') setSelectedEmpenhoDetailId(null);
            setSidebarOpen(false);
          }}
          onLogout={async () => {
            try {
              setShowLoginSuccessTransition(false);
              await signOutUser();
              showToast('Você saiu do sistema.', 'info');
            } catch (err: any) {
              console.error(err);
              showToast('Erro ao sair do sistema', 'error');
            }
          }}
          warehouseModuleEnabled={canAccessWarehouseModule(workspaceContext)}
          onOpenWarehouse={() => {
            window.location.assign('/adm-deposito');
          }}
        />

        {/* Content Container Area */}
        <main
          className={`flex-1 w-full overflow-hidden ${activeTab === 'inicio'
            ? 'p-0 pb-20 md:pb-0 max-w-none'
            : 'lg:pl-6 pb-24 md:pb-12 pt-6 px-4 max-w-7xl mx-auto'
          }`}
        >
          {!activeOperationalDataReady && <OperationalSurfaceLoading />}

          {activeOperationalDataReady && activeTab === 'inicio' && (
            <OperationalSurfaceTransition key="inicio-surface" surfaceKey={activeTab}>
              <InicioView
                snapshot={inicioSnapshot}
                userDisplayName={user?.displayName || 'Operador EMPROVEX'}
                onSelectEmpenho={(empenhoId) => {
                  setSelectedEmpenhoDetailId(empenhoId);
                  setActiveTab('empenhos');
                }}
              />
            </OperationalSurfaceTransition>
          )}

          {(activeTab !== 'inicio' || hasOpenedOperationalSurface) && (
            <Suspense
              key="operational-workspace"
              fallback={activeOperationalDataReady ? <OperationalSurfaceLoading /> : null}
            >
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
            </Suspense>
          )}
        </main>
      </div>

      <MobileNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setSelectedEmpenhoDetailId={setSelectedEmpenhoDetailId}
      />

    </div>
  );
}
