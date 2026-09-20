'use client';

import { useEffect, useRef } from 'react';

import type { InicioOperationalSnapshot } from '../domain/homeOperationalSnapshot';
import { useInicioPerformanceProfile } from '../hooks/useInicioPerformanceProfile';
import { InicioAtmosphere } from './InicioAtmosphere';
import { InicioConstellation } from './InicioConstellation';
import { InicioCore } from './InicioCore';
import { InicioEntrySequence } from './InicioEntrySequence';
import { InicioIdentityPanel } from './InicioIdentityPanel';
import { InicioInteractionLayer } from './InicioInteractionLayer';
import { InicioOrbitSystem } from './InicioOrbitSystem';
import { InicioSceneChrome } from './InicioSceneChrome';
import styles from './InicioView.module.css';

interface InicioViewProps {
  snapshot: InicioOperationalSnapshot | null;
  userDisplayName: string;
  onSelectEmpenho: (empenhoId: string) => void;
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
  onSelectEmpenho,
}: InicioViewProps) {
  const rootRef = useRef<HTMLElement>(null);
  const { mode: performanceMode, ambientPaused } = useInicioPerformanceProfile();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || performanceMode !== 'full' || ambientPaused) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    if (!finePointer.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const apply = () => {
      root.style.setProperty('--home-shift-x', `${(currentX * 10).toFixed(2)}px`);
      root.style.setProperty('--home-shift-y', `${(currentY * 8).toFixed(2)}px`);
      root.style.setProperty('--home-shift-x-inverse', `${(currentX * -6).toFixed(2)}px`);
      root.style.setProperty('--home-shift-y-inverse', `${(currentY * -5).toFixed(2)}px`);
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      apply();

      const settled =
        Math.abs(targetX - currentX) < 0.001
        && Math.abs(targetY - currentY) < 0.001;

      if (settled) {
        currentX = targetX;
        currentY = targetY;
        apply();
        frame = 0;
        return;
      }

      frame = window.requestAnimationFrame(render);
    };

    const scheduleFrame = () => {
      if (!frame && document.visibilityState === 'visible') {
        frame = window.requestAnimationFrame(render);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      targetY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      scheduleFrame();
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
      scheduleFrame();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ambientPaused, performanceMode]);

  const totalEmpenhos = snapshot?.metrics.totalEmpenhos ?? 0;
  const totalValue = snapshot?.metrics.totalValue ?? 0;
  const activeAlertCount = snapshot?.alerts.total ?? 0;
  const enableFineMotion = performanceMode === 'full' && !ambientPaused;

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="inicio-scene"
      data-ready="true"
      data-snapshot={snapshot ? 'ready' : 'empty'}
      data-performance={performanceMode}
      data-ambient-paused={ambientPaused ? 'true' : 'false'}
      aria-label="Início EMPROVEX"
    >
      <InicioEntrySequence />
      <InicioAtmosphere />
      <InicioSceneChrome />
      <InicioInteractionLayer
        sceneRef={rootRef}
        enabled={enableFineMotion}
      />
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <InicioConstellation
        snapshot={snapshot}
        onSelectEmpenho={onSelectEmpenho}
      />

      <InicioIdentityPanel userDisplayName={userDisplayName} />

      <div
        className={styles.system}
        data-testid="inicio-system"
        aria-label="Sistema solar operacional EMPROVEX"
      >
        <InicioOrbitSystem snapshot={snapshot} />

        <InicioCore
          totalEmpenhos={totalEmpenhos}
          totalValueLabel={formatCurrency(totalValue)}
          activeAlertCount={activeAlertCount}
          interactiveMotion={enableFineMotion}
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

    </section>
  );
}
