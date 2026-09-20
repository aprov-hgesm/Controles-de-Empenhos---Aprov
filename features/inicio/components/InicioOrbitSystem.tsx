'use client';

import { Activity, BellRing, Gauge, Orbit, PackageCheck } from 'lucide-react';
import { useMemo } from 'react';

import type { Alert, Empenho } from '../../../lib/types';
import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import styles from './InicioOrbitSystem.module.css';

interface InicioOrbitSystemProps {
  empenhos: Empenho[];
  alerts: Alert[];
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

function getEmpenhoTotals(empenho: Empenho) {
  return empenho.items.reduce(
    (acc, item) => {
      const committed = item.quantity * item.unitPrice;
      const received = Math.min(item.received, item.quantity) * item.unitPrice;
      acc.committed += committed;
      acc.received += received;
      acc.balance += Math.max(0, item.quantity - item.received) * item.unitPrice;
      if (item.received < item.quantity) acc.pendingItems += 1;
      return acc;
    },
    { committed: 0, received: 0, balance: 0, pendingItems: 0 }
  );
}

export function InicioOrbitSystem({
  empenhos,
  alerts,
  onNavigate,
}: InicioOrbitSystemProps) {
  const metrics = useMemo(() => {
    let committed = 0;
    let received = 0;
    let balance = 0;
    let pendingItems = 0;
    let pendingEmpenhos = 0;

    empenhos.forEach((empenho) => {
      const totals = getEmpenhoTotals(empenho);
      committed += totals.committed;
      received += totals.received;
      balance += totals.balance;
      pendingItems += totals.pendingItems;
      if (totals.pendingItems > 0) pendingEmpenhos += 1;
    });

    return {
      committed,
      received,
      balance,
      pendingItems,
      pendingEmpenhos,
      executionPct: committed > 0 ? Math.round((received / committed) * 100) : 0,
    };
  }, [empenhos]);

  const classStats = useMemo(
    () => CLASS_CODES.map((code) => {
      const related = empenhos.filter(
        (empenho) => (empenho.classification || 'QR').trim().toUpperCase() === code
      );

      return {
        code,
        count: related.length,
        value: related.reduce((sum, empenho) => sum + getEmpenhoTotals(empenho).committed, 0),
      };
    }),
    [empenhos]
  );

  const alertSeverity = useMemo(() => {
    const critical = alerts.filter(
      (alert) => alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO'
    ).length;

    return {
      total: alerts.length,
      critical,
      attention: Math.max(0, alerts.length - critical),
    };
  }, [alerts]);

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
        aria-label={`Recebimentos: ${metrics.pendingEmpenhos} empenhos com saldo`}
      >
        <span className={styles.planetGlow} aria-hidden="true" />
        <span className={styles.planetSurface}>
          <PackageCheck aria-hidden="true" />
        </span>
        <span className={styles.tooltip}>
          <strong>Recebimentos</strong>
          <span>{metrics.pendingEmpenhos} empenhos com saldo</span>
          <small>
            {metrics.pendingItems} item(ns) pendentes · {formatCurrency(metrics.balance)}
          </small>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.planet} ${styles.executionPlanet}`}
        onClick={() => onNavigate('painel')}
        aria-label={`Execução estimada: ${metrics.executionPct}%`}
      >
        <span
          className={styles.executionHalo}
          style={{ ['--execution' as string]: `${metrics.executionPct}%` }}
          aria-hidden="true"
        />
        <span className={styles.planetSurface}>
          <Activity aria-hidden="true" />
        </span>
        <span className={styles.tooltip}>
          <strong>Execução</strong>
          <span>{metrics.executionPct}% recebido/liquidado</span>
          <small>
            {formatCurrency(metrics.received)} de {formatCurrency(metrics.committed)}
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
        <span>{metrics.executionPct}% EXEC</span>
      </div>
    </div>
  );
}
