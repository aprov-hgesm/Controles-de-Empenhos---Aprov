'use client';

import { Activity, BellRing, Gauge, Orbit, PackageCheck } from 'lucide-react';

import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import type { InicioOperationalSnapshot } from '../domain/homeOperationalSnapshot';
import styles from './InicioOrbitSystem.module.css';

interface InicioOrbitSystemProps {
  snapshot: InicioOperationalSnapshot | null;
  onNavigate: (tab: OperationalActiveTab) => void;
}

const CLASS_CODES = ['QR', 'CALI', 'PASA', 'FUNADOM'] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

export function InicioOrbitSystem({
  snapshot,
  onNavigate,
}: InicioOrbitSystemProps) {
  const alertSeverity = snapshot?.alerts ?? {
    total: 0,
    critical: 0,
    attention: 0,
  };

  const receiving = snapshot?.receiving ?? {
    pendingEmpenhos: 0,
    pendingItems: 0,
    balance: 0,
  };

  const execution = snapshot?.execution ?? {
    committed: 0,
    received: 0,
    percentage: 0,
  };

  const classStats = CLASS_CODES.map((code) => {
    const item = snapshot?.classStats.find((entry) => entry.code === code);
    return item ?? { code, count: 0, value: 0 };
  });

  return (
    <div className={styles.root} aria-label="Sistema orbital operacional EMPROVEX">
      <div className={`${styles.track} ${styles.trackOuter}`} aria-hidden="true" />
      <div className={`${styles.track} ${styles.trackMid}`} aria-hidden="true" />
      <div className={`${styles.track} ${styles.trackInner}`} aria-hidden="true" />

      <div className={`${styles.sweep} ${styles.sweepOuter}`} aria-hidden="true" />
      <div className={`${styles.sweep} ${styles.sweepInner}`} aria-hidden="true" />

      <button
        type="button"
        className={`${styles.planet} ${styles.alertPlanet}`}
        data-alert={alertSeverity.total > 0 ? 'true' : 'false'}
        onClick={() => onNavigate('painel')}
        aria-label={`Alertas operacionais: ${alertSeverity.total} ativos`}
      >
        <span className={styles.planetGlow} aria-hidden="true" />
        <span className={styles.planetSurface}>
          <BellRing aria-hidden="true" />
        </span>
        <span className={styles.tooltip}>
          <strong>Alertas operacionais</strong>
          <span>{alertSeverity.total} ativos</span>
          <small>
            {alertSeverity.critical > 0
              ? `${alertSeverity.critical} crítico(s) · ${alertSeverity.attention} atenção`
              : alertSeverity.total > 0
                ? `${alertSeverity.attention} em atenção`
                : 'Nenhuma pendência ativa'}
          </small>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.planet} ${styles.receivingPlanet}`}
        onClick={() => onNavigate('itens')}
        aria-label={`Recebimentos: ${receiving.pendingEmpenhos} empenhos com saldo`}
      >
        <span className={styles.planetGlow} aria-hidden="true" />
        <span className={styles.planetSurface}>
          <PackageCheck aria-hidden="true" />
        </span>
        <span className={styles.tooltip}>
          <strong>Recebimentos</strong>
          <span>{receiving.pendingEmpenhos} empenhos com saldo</span>
          <small>
            {receiving.pendingItems} item(ns) pendentes · {formatCurrency(receiving.balance)}
          </small>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.planet} ${styles.executionPlanet}`}
        onClick={() => onNavigate('painel')}
        aria-label={`Execução estimada: ${execution.percentage}%`}
      >
        <span
          className={styles.executionHalo}
          style={{ ['--execution' as string]: `${execution.percentage}%` }}
          aria-hidden="true"
        />
        <span className={styles.planetSurface}>
          <Activity aria-hidden="true" />
        </span>
        <span className={styles.tooltip}>
          <strong>Execução</strong>
          <span>{execution.percentage}% recebido/liquidado</span>
          <small>
            {formatCurrency(execution.received)} de {formatCurrency(execution.committed)}
          </small>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.planet} ${styles.dashboardPlanet}`}
        onClick={() => onNavigate('painel')}
        aria-label="Abrir Painel de Controle"
      >
        <span className={styles.planetGlow} aria-hidden="true" />
        <span className={styles.planetSurface}>
          <Gauge aria-hidden="true" />
        </span>
        <span className={styles.tooltip}>
          <strong>Painel</strong>
          <span>Visão analítica</span>
          <small>Abrir saldos, filtros e indicadores detalhados</small>
        </span>
      </button>

      <div className={styles.classSystem} aria-label="Classes de empenho">
        <button
          type="button"
          className={styles.classPlanet}
          onClick={() => onNavigate('painel')}
          aria-label="Abrir classes de empenho no Painel"
        >
          <span className={styles.classPlanetOrbit} aria-hidden="true" />
          <Orbit aria-hidden="true" />
          <span>Classes</span>
        </button>

        <div className={styles.classMoons}>
          {classStats.map((item, index) => (
            <button
              key={item.code}
              type="button"
              className={styles.classMoon}
              style={{ ['--moon-index' as string]: index }}
              onClick={() => onNavigate('painel')}
              aria-label={`${item.code}: ${item.count} empenhos, ${formatCurrency(item.value)}`}
            >
              <i aria-hidden="true" />
              <span>
                <strong>{item.code}</strong>
                <small>{formatCurrency(item.value)}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.orbitCaption} aria-hidden="true">
        <span>OPERATIONAL ORBIT</span>
        <i />
        <span>{execution.percentage}% EXEC</span>
      </div>
    </div>
  );
}
