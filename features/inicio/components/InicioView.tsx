'use client';

import { useEffect, useRef } from 'react';

import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import type { InicioOperationalSnapshot } from '../domain/homeOperationalSnapshot';
import type { InicioResumeTarget } from '../hooks/useInicioWorkMemory';
import { InicioAtmosphere } from './InicioAtmosphere';
import { InicioConstellation } from './InicioConstellation';
import { InicioCore } from './InicioCore';
import { InicioEntrySequence } from './InicioEntrySequence';
import { InicioIdentityPanel } from './InicioIdentityPanel';
import { InicioInteractionLayer } from './InicioInteractionLayer';
import { InicioOrbitSystem } from './InicioOrbitSystem';
import { InicioQuickActions } from './InicioQuickActions';
import styles from './InicioView.module.css';

interface InicioViewProps {
  snapshot: InicioOperationalSnapshot | null;
  userDisplayName: string;
  workspaceName: string;
  organizationName: string;
  organizationShortName: string | null;
  sectionName: string;
  workspaceUg: string | null;
  isFoundingWorkspace: boolean;
  customLogo: string | null;
  resumeTarget: InicioResumeTarget | null;
  onNavigate: (tab: OperationalActiveTab) => void;
  onSelectEmpenho: (empenhoId: string) => void;
  onResumeWork: () => void;
  onCreateEmpenho: () => void;
  onRegisterInvoice: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

export function InicioView({
  snapshot,
  userDisplayName,
  workspaceName,
  organizationName,
  organizationShortName,
  sectionName,
  workspaceUg,
  isFoundingWorkspace,
  customLogo,
  resumeTarget,
  onNavigate,
  onSelectEmpenho,
  onResumeWork,
  onCreateEmpenho,
  onRegisterInvoice,
}: InicioViewProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      root.style.setProperty('--home-shift-x', `${(currentX * 10).toFixed(2)}px`);
      root.style.setProperty('--home-shift-y', `${(currentY * 8).toFixed(2)}px`);
      root.style.setProperty('--home-shift-x-inverse', `${(currentX * -6).toFixed(2)}px`);
      root.style.setProperty('--home-shift-y-inverse', `${(currentY * -5).toFixed(2)}px`);
      frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      targetY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const totalEmpenhos = snapshot?.metrics.totalEmpenhos ?? 0;
  const totalValue = snapshot?.metrics.totalValue ?? 0;
  const activeAlertCount = snapshot?.alerts.total ?? 0;

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-ready="true"
      data-snapshot={snapshot ? 'ready' : 'empty'}
      aria-label="Início EMPROVEX"
    >
      <InicioEntrySequence />
      <InicioAtmosphere />
      <InicioInteractionLayer sceneRef={rootRef} />
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <InicioConstellation
        snapshot={snapshot}
        onSelectEmpenho={onSelectEmpenho}
      />

      <InicioIdentityPanel
        userDisplayName={userDisplayName}
        workspaceName={workspaceName}
        organizationName={organizationName}
        organizationShortName={organizationShortName}
        sectionName={sectionName}
        workspaceUg={workspaceUg}
        isFoundingWorkspace={isFoundingWorkspace}
      />

      <div className={styles.system} aria-label="Sistema solar operacional EMPROVEX">
        <InicioOrbitSystem
          snapshot={snapshot}
          onNavigate={onNavigate}
        />

        <InicioCore
          customLogo={customLogo}
          totalEmpenhos={totalEmpenhos}
          totalValueLabel={formatCurrency(totalValue)}
          activeAlertCount={activeAlertCount}
          onOpenEmpenhos={() => onNavigate('empenhos')}
        />
      </div>

      {!snapshot && (
        <div className={styles.snapshotNotice} role="status">
          <strong>Mapa econômico ainda não consolidado</strong>
          <span>
            O Início não abrirá coleções brutas. O snapshot será criado automaticamente
            quando Empenhos ou Notas Fiscais estiverem em uso.
          </span>
        </div>
      )}

      <div className={styles.interactionHint} aria-hidden="true">
        <span />
        <p>Explore os elementos do mapa com o cursor</p>
      </div>

      <InicioQuickActions
        resumeTarget={resumeTarget}
        onResume={onResumeWork}
        onCreateEmpenho={onCreateEmpenho}
        onRegisterInvoice={onRegisterInvoice}
        onNavigate={onNavigate}
      />
    </section>
  );
}
