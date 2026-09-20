'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Sparkles } from 'lucide-react';

import type { Alert, Empenho } from '../../../lib/types';
import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import { InicioAtmosphere } from './InicioAtmosphere';
import { InicioEntrySequence } from './InicioEntrySequence';
import { InicioConstellation } from './InicioConstellation';
import { InicioCore } from './InicioCore';
import { InicioOrbitSystem } from './InicioOrbitSystem';
import styles from './InicioView.module.css';

interface InicioViewProps {
  empenhos: Empenho[];
  alerts: Alert[];
  userDisplayName: string;
  workspaceUg: string | null;
  customLogo: string | null;
  onNavigate: (tab: OperationalActiveTab) => void;
  onSelectEmpenho: (empenhoId: string) => void;
}

function getEmpenhoValue(empenho: Empenho): number {
  return empenho.items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

export function InicioView({
  empenhos,
  alerts,
  userDisplayName,
  workspaceUg,
  customLogo,
  onNavigate,
  onSelectEmpenho,
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

  const totalValue = useMemo(
    () => empenhos.reduce((total, empenho) => total + getEmpenhoValue(empenho), 0),
    [empenhos]
  );

  const activeAlertCount = alerts.length;

  const firstName = userDisplayName.trim().split(/\s+/)[0] || 'Operador';

  return (
    <section ref={rootRef} className={styles.scene} data-ready="true" aria-label="Início EMPROVEX">
      <InicioEntrySequence />
      <InicioAtmosphere />
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
      <InicioConstellation
        empenhos={empenhos}
        alerts={alerts}
        onSelectEmpenho={onSelectEmpenho}
      />

      <header className={styles.copy}>
        <div className={styles.kicker}>
          <Sparkles aria-hidden="true" />
          <span>Mapa operacional</span>
        </div>
        <h2>Bem-vindo de volta, {firstName}.</h2>
        <p>
          Cada estrela representa um empenho. O ambiente reage ao estado real da operação
          sem substituir o painel analítico.
        </p>
        <div className={styles.identity}>
          <span>EMPROVEX ONLINE</span>
          {workspaceUg && <span>UG {workspaceUg}</span>}
        </div>
      </header>

      <div className={styles.system} aria-label="Sistema solar operacional EMPROVEX">
        <InicioOrbitSystem
          empenhos={empenhos}
          alerts={alerts}
          onNavigate={onNavigate}
        />

        <InicioCore
          customLogo={customLogo}
          totalEmpenhos={empenhos.length}
          totalValueLabel={formatCurrency(totalValue)}
          activeAlertCount={activeAlertCount}
          onOpenEmpenhos={() => onNavigate('empenhos')}
        />
      </div>

      <div className={styles.interactionHint} aria-hidden="true">
        <span />
        <p>Explore os elementos do mapa com o cursor</p>
      </div>

    </section>
  );
}
