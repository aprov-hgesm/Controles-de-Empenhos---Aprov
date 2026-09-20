'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Sparkles } from 'lucide-react';

import type { Alert, Empenho } from '../../../lib/types';
import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import { InicioAtmosphere } from './InicioAtmosphere';
import { InicioEntrySequence } from './InicioEntrySequence';
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
}

type StarSeverity = 'normal' | 'attention' | 'critical';

interface StarNode {
  id: string;
  supplier: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  severity: StarSeverity;
  message: string;
}

const MAX_VISIBLE_STARS = 72;

function hashValue(value: string, seed = 0): number {
  let hash = 2166136261 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
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

function getSeverity(empenho: Empenho, alertsByEmpenho: Map<string, Alert[]>): StarSeverity {
  const linkedAlerts = alertsByEmpenho.get(empenho.id) ?? [];
  if (
    empenho.status === 'Urgente'
    || linkedAlerts.some((alert) => alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO')
  ) {
    return 'critical';
  }

  if (
    empenho.status === 'Sem Movimentação'
    || (empenho.lastNFDaysAgo ?? 0) >= 10
    || linkedAlerts.some((alert) => alert.type === 'ATENÇÃO')
  ) {
    return 'attention';
  }

  return 'normal';
}

function getStarMessage(empenho: Empenho, alertsByEmpenho: Map<string, Alert[]>): string {
  const linkedAlert = (alertsByEmpenho.get(empenho.id) ?? [])[0];
  if (linkedAlert) {
    return linkedAlert.subtitle || linkedAlert.title || linkedAlert.description;
  }

  if (empenho.status === 'Urgente') return 'Empenho marcado como urgente.';
  if (empenho.status === 'Sem Movimentação') return 'Empenho sem movimentação recente.';
  if ((empenho.lastNFDaysAgo ?? 0) >= 10) {
    return `Última nota fiscal registrada há ${empenho.lastNFDaysAgo} dias.`;
  }

  return 'Operação sem sinal de atenção ativo.';
}

export function InicioView({
  empenhos,
  alerts,
  userDisplayName,
  workspaceUg,
  customLogo,
  onNavigate,
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

  const alertsByEmpenho = useMemo(() => {
    const map = new Map<string, Alert[]>();
    alerts.forEach((alert) => {
      if (!alert.empenhoId) return;
      const current = map.get(alert.empenhoId) ?? [];
      current.push(alert);
      map.set(alert.empenhoId, current);
    });
    return map;
  }, [alerts]);

  const totalValue = useMemo(
    () => empenhos.reduce((total, empenho) => total + getEmpenhoValue(empenho), 0),
    [empenhos]
  );

  const activeAlertCount = alerts.length;

  const stars = useMemo<StarNode[]>(() => {
    const ordered = [...empenhos].sort((left, right) => {
      const severityOrder: Record<StarSeverity, number> = {
        critical: 0,
        attention: 1,
        normal: 2,
      };
      return (
        severityOrder[getSeverity(left, alertsByEmpenho)]
        - severityOrder[getSeverity(right, alertsByEmpenho)]
      );
    });

    return ordered.slice(0, MAX_VISIBLE_STARS).map((empenho, index) => {
      const hashX = hashValue(empenho.id, 11);
      const hashY = hashValue(empenho.id, 29);
      const hashSize = hashValue(empenho.id, 47);
      return {
        id: empenho.id,
        supplier: empenho.supplier,
        left: 4 + (hashX % 92),
        top: 5 + (hashY % 88),
        size: 3 + (hashSize % 4),
        delay: -((index % 12) * 0.43),
        severity: getSeverity(empenho, alertsByEmpenho),
        message: getStarMessage(empenho, alertsByEmpenho),
      };
    });
  }, [alertsByEmpenho, empenhos]);

  const firstName = userDisplayName.trim().split(/\s+/)[0] || 'Operador';

  return (
    <section ref={rootRef} className={styles.scene} data-ready="true" aria-label="Início EMPROVEX">
      <InicioEntrySequence />
      <InicioAtmosphere />
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.starField} aria-label="Constelação operacional de empenhos">
        {stars.map((star) => (
          <button
            key={star.id}
            type="button"
            className={styles.star}
            data-severity={star.severity}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              animationDelay: `${star.delay}s`,
            }}
            onClick={() => onNavigate('empenhos')}
            aria-label={`${star.id}: ${star.message}`}
          >
            <span className={styles.starHalo} aria-hidden="true" />
            <span className={styles.starTooltip}>
              <strong>{star.id}</strong>
              <span>{star.message}</span>
              <small>{star.supplier}</small>
            </span>
          </button>
        ))}
      </div>

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

      <footer className={styles.legend}>
        <span><i data-severity="normal" /> Regular</span>
        <span><i data-severity="attention" /> Atenção</span>
        <span><i data-severity="critical" /> Crítico</span>
        {empenhos.length > MAX_VISIBLE_STARS && (
          <span>Mostrando {MAX_VISIBLE_STARS} de {empenhos.length} estrelas</span>
        )}
      </footer>
    </section>
  );
}
