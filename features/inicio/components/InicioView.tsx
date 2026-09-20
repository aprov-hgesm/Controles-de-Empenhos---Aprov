'use client';

import { useEffect, useMemo, useRef } from 'react';
import { BellRing, Gauge, Orbit, Sparkles } from 'lucide-react';

import type { Alert, Empenho } from '../../../lib/types';
import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import { InicioAtmosphere } from './InicioAtmosphere';
import { InicioEntrySequence } from './InicioEntrySequence';
import styles from './InicioView.module.css';

interface InicioViewProps {
  empenhos: Empenho[];
  alerts: Alert[];
  userDisplayName: string;
  workspaceUg: string | null;
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

const CLASS_CODES = ['QR', 'CALI', 'PASA', 'FUNADOM'] as const;
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

  const classStats = useMemo(
    () => CLASS_CODES.map((code) => {
      const related = empenhos.filter(
        (empenho) => (empenho.classification || 'QR').trim().toUpperCase() === code
      );
      return {
        code,
        count: related.length,
        value: related.reduce((total, empenho) => total + getEmpenhoValue(empenho), 0),
      };
    }),
    [empenhos]
  );

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
    <section ref={rootRef} className={styles.scene} aria-label="Início EMPROVEX">
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
        <div className={styles.orbitOuter} aria-hidden="true">
          <span className={styles.orbitBeacon} />
        </div>
        <div className={styles.orbitInner} aria-hidden="true">
          <span className={styles.orbitBeacon} />
        </div>
        <div className={styles.orbitSignal} aria-hidden="true" />

        <button
          type="button"
          className={styles.sun}
          onClick={() => onNavigate('empenhos')}
          aria-label={`Abrir empenhos. ${empenhos.length} empenhos cadastrados.`}
        >
          <span className={styles.sunCorona} aria-hidden="true" />
          <span className={styles.sunCore}>
            <span className={styles.sunSymbol}>EMP</span>
          </span>
          <span className={styles.celestialTooltip}>
            <strong>Núcleo EMPROVEX</strong>
            <span>{empenhos.length} empenhos cadastrados</span>
            <small>{formatCurrency(totalValue)} empenhados</small>
          </span>
        </button>

        <button
          type="button"
          className={`${styles.planet} ${styles.alertPlanet}`}
          data-alert={activeAlertCount > 0 ? 'true' : 'false'}
          onClick={() => onNavigate('painel')}
          aria-label={`Abrir painel. ${activeAlertCount} alertas ativos.`}
        >
          <span className={styles.planetRing} aria-hidden="true" />
          <BellRing aria-hidden="true" />
          <span className={styles.celestialTooltip}>
            <strong>Alertas operacionais</strong>
            <span>{activeAlertCount} ativos</span>
            <small>{activeAlertCount > 0 ? 'Requerem leitura do operador' : 'Nenhuma pendência ativa'}</small>
          </span>
        </button>

        <button
          type="button"
          className={`${styles.planet} ${styles.dashboardPlanet}`}
          onClick={() => onNavigate('painel')}
          aria-label="Abrir Painel de Controle"
        >
          <Gauge aria-hidden="true" />
          <span className={styles.celestialTooltip}>
            <strong>Painel</strong>
            <span>Visão analítica</span>
            <small>Abrir indicadores e saldos</small>
          </span>
        </button>

        <div className={styles.classSystem} aria-label="Valores por classe de empenho">
          <div className={styles.classPlanet}>
            <Orbit aria-hidden="true" />
            <span>Classes</span>
          </div>
          <div className={styles.classMoons}>
            {classStats.map((item) => (
              <button
                key={item.code}
                type="button"
                className={styles.classMoon}
                onClick={() => onNavigate('painel')}
                aria-label={`${item.code}: ${item.count} empenhos, ${formatCurrency(item.value)}`}
              >
                <strong>{item.code}</strong>
                <span>{formatCurrency(item.value)}</span>
              </button>
            ))}
          </div>
        </div>
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
