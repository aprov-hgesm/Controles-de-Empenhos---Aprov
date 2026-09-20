'use client';

import { useRef, useState } from 'react';

import { Activity, BellRing, Gauge, Orbit, PackageCheck } from 'lucide-react';

import type { InicioOperationalSnapshot } from '../domain/homeOperationalSnapshot';
import styles from './InicioOrbitSystem.module.css';

interface InicioOrbitSystemProps {
  snapshot: InicioOperationalSnapshot | null;
}

type OrbitTooltipKey =
  | 'alerts'
  | 'receiving'
  | 'execution'
  | 'dashboard'
  | 'classes';

interface OrbitTooltipState {
  key: OrbitTooltipKey;
  left: number;
  top: number;
  placement: 'above' | 'below';
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
}: InicioOrbitSystemProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [tooltipState, setTooltipState] = useState<OrbitTooltipState | null>(null);

  const showTooltip = (
    key: OrbitTooltipKey,
    target: HTMLElement
  ) => {
    const root = rootRef.current;
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (rootRect.width <= 0 || rootRect.height <= 0) return;

    const left =
      ((targetRect.left + targetRect.width / 2 - rootRect.left) / rootRect.width) * 100;
    const top =
      ((targetRect.top + targetRect.height / 2 - rootRect.top) / rootRect.height) * 100;
    const horizontalClamp = key === 'classes' ? 22 : 20;

    setTooltipState({
      key,
      left: Math.min(100 - horizontalClamp, Math.max(horizontalClamp, left)),
      top,
      placement: top < 26 ? 'below' : 'above',
    });
  };

  const hideTooltip = () => setTooltipState(null);
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
    <div
      ref={rootRef}
      className={styles.root}
      data-testid="inicio-orbit-system"
      aria-label="Sistema orbital operacional EMPROVEX"
    >
      <div className={`${styles.track} ${styles.trackOuter}`} aria-hidden="true" />
      <div className={`${styles.track} ${styles.trackMid}`} aria-hidden="true" />
      <div className={`${styles.track} ${styles.trackInner}`} aria-hidden="true" />

      <div
        className={`${styles.starOrbitLane} ${styles.starOrbitOuter}`}
        data-inicio-star-orbit="outer"
        aria-hidden="true"
      />
      <div
        className={`${styles.starOrbitLane} ${styles.starOrbitMiddle}`}
        data-inicio-star-orbit="middle"
        aria-hidden="true"
      />
      <div
        className={`${styles.starOrbitLane} ${styles.starOrbitInner}`}
        data-inicio-star-orbit="inner"
        aria-hidden="true"
      />

      <div className={`${styles.sweep} ${styles.sweepOuter}`} aria-hidden="true" />
      <div className={`${styles.sweep} ${styles.sweepInner}`} aria-hidden="true" />

      <div className={`${styles.orbitSlot} ${styles.orbitOuter} ${styles.orbitPhaseA}`}>
        <div className={styles.orbitAnchor}>
              <div
                tabIndex={0}
                className={`${styles.planet} ${styles.alertPlanet}`}
                onMouseEnter={(event) => showTooltip('alerts', event.currentTarget)}
                onMouseLeave={hideTooltip}
                onFocus={(event) => showTooltip('alerts', event.currentTarget)}
                onBlur={hideTooltip}
                data-alert={alertSeverity.total > 0 ? 'true' : 'false'}
                aria-label={`Alertas operacionais: ${alertSeverity.total} ativos`}
              >
                <span className={styles.planetGlow} aria-hidden="true" />
                <span className={styles.planetSurface}>
                  <span className={styles.planetMaterial} aria-hidden="true" />
                  <span className={styles.planetBands} aria-hidden="true" />
                  <span className={styles.planetSpecular} aria-hidden="true" />
                  <BellRing aria-hidden="true" />
                </span>
                <span className={styles.planetHud} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
        
        
        </div>
      </div>

      <div className={`${styles.orbitSlot} ${styles.orbitMiddle} ${styles.orbitPhaseA}`}>
        <div className={styles.orbitAnchor}>
              <div
                tabIndex={0}
                className={`${styles.planet} ${styles.receivingPlanet}`}
                onMouseEnter={(event) => showTooltip('receiving', event.currentTarget)}
                onMouseLeave={hideTooltip}
                onFocus={(event) => showTooltip('receiving', event.currentTarget)}
                onBlur={hideTooltip}
                aria-label={`Recebimentos: ${receiving.pendingEmpenhos} empenhos com saldo`}
              >
                <span className={styles.planetGlow} aria-hidden="true" />
                <span className={styles.planetSurface}>
                  <span className={styles.planetMaterial} aria-hidden="true" />
                  <span className={styles.planetBands} aria-hidden="true" />
                  <span className={styles.planetSpecular} aria-hidden="true" />
                  <PackageCheck aria-hidden="true" />
                </span>
                <span className={styles.planetHud} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
        
        
        </div>
      </div>

      <div className={`${styles.orbitSlot} ${styles.orbitInner} ${styles.orbitPhaseC}`}>
        <div className={styles.orbitAnchor}>
              <div
                tabIndex={0}
                className={`${styles.planet} ${styles.executionPlanet}`}
                onMouseEnter={(event) => showTooltip('execution', event.currentTarget)}
                onMouseLeave={hideTooltip}
                onFocus={(event) => showTooltip('execution', event.currentTarget)}
                onBlur={hideTooltip}
                aria-label={`Execução estimada: ${execution.percentage}%`}
              >
                <span
                  className={styles.executionHalo}
                  style={{ ['--execution' as string]: `${execution.percentage}%` }}
                  aria-hidden="true"
                />
                <span className={styles.planetSurface}>
                  <span className={styles.planetMaterial} aria-hidden="true" />
                  <span className={styles.planetBands} aria-hidden="true" />
                  <span className={styles.planetSpecular} aria-hidden="true" />
                  <Activity aria-hidden="true" />
                </span>
                <span className={styles.planetHud} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
        
        
        </div>
      </div>

      <div className={`${styles.orbitSlot} ${styles.orbitOuter} ${styles.orbitPhaseB}`}>
        <div className={styles.orbitAnchor}>
              <div
                tabIndex={0}
                className={`${styles.planet} ${styles.dashboardPlanet}`}
                onMouseEnter={(event) => showTooltip('dashboard', event.currentTarget)}
                onMouseLeave={hideTooltip}
                onFocus={(event) => showTooltip('dashboard', event.currentTarget)}
                onBlur={hideTooltip}
                aria-label="Painel de Controle"
              >
                <span className={styles.planetGlow} aria-hidden="true" />
                <span className={styles.planetSurface}>
                  <span className={styles.planetMaterial} aria-hidden="true" />
                  <span className={styles.planetBands} aria-hidden="true" />
                  <span className={styles.planetSpecular} aria-hidden="true" />
                  <Gauge aria-hidden="true" />
                </span>
                <span className={styles.planetHud} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
        
        
        </div>
      </div>

      <div className={`${styles.orbitSlot} ${styles.orbitMiddle} ${styles.orbitPhaseB}`}>
        <div className={styles.orbitAnchor}>
              <div className={styles.classSystem} aria-label="Classes de empenho">
                <div
                  tabIndex={0}
                  className={styles.classPlanet}
                  aria-label="Classes de empenho"
                  onMouseEnter={(event) => showTooltip('classes', event.currentTarget)}
                  onMouseLeave={hideTooltip}
                  onFocus={(event) => showTooltip('classes', event.currentTarget)}
                  onBlur={hideTooltip}
                >
                  <span className={styles.classPlanetOrbit} aria-hidden="true" />
                  <span className={styles.classMaterial} aria-hidden="true" />
                  <span className={styles.classFacet} aria-hidden="true" />
                  <span className={styles.classHud} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <Orbit aria-hidden="true" />
                  <span>Classes</span>
                </div>
              </div>
        
        
        </div>
      </div>

      {tooltipState && (
        <div
          className={
            tooltipState.key === 'classes'
              ? styles.floatingClassTooltip
              : styles.floatingTooltip
          }
          data-placement={tooltipState.placement}
          role="tooltip"
          style={{
            left: `${tooltipState.left}%`,
            top: `${tooltipState.top}%`,
          }}
        >
          {tooltipState.key === 'alerts' && (
            <>
              <strong>Alertas operacionais</strong>
              <span>{alertSeverity.total} ativos</span>
              <small>
                {alertSeverity.critical > 0
                  ? `${alertSeverity.critical} crítico(s) · ${alertSeverity.attention} atenção`
                  : alertSeverity.total > 0
                    ? `${alertSeverity.attention} em atenção`
                    : 'Nenhuma pendência ativa'}
              </small>
            </>
          )}

          {tooltipState.key === 'receiving' && (
            <>
              <strong>Recebimentos</strong>
              <span>{receiving.pendingEmpenhos} empenhos com saldo</span>
              <small>
                {receiving.pendingItems} item(ns) pendentes · {formatCurrency(receiving.balance)}
              </small>
            </>
          )}

          {tooltipState.key === 'execution' && (
            <>
              <strong>Execução</strong>
              <span>{execution.percentage}% recebido/liquidado</span>
              <small>
                {formatCurrency(execution.received)} de {formatCurrency(execution.committed)}
              </small>
            </>
          )}

          {tooltipState.key === 'dashboard' && (
            <>
              <strong>Painel</strong>
              <span>Visão analítica</span>
              <small>Saldos, filtros e indicadores detalhados</small>
            </>
          )}

          {tooltipState.key === 'classes' && (
            <>
              <div className={styles.classTooltipHeader}>
                <strong>Classes de empenho</strong>
                <span>
                  {classStats.reduce((total, item) => total + item.count, 0)} empenho(s)
                </span>
                <span className={styles.planetHud} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>

              <div className={styles.classTooltipList}>
                {classStats.map((item) => (
                  <div key={item.code} className={styles.classTooltipRow}>
                    <i aria-hidden="true" />
                    <span>
                      <strong>{item.code}</strong>
                      <small>{item.count} empenho(s)</small>
                    </span>
                    <em>{formatCurrency(item.value)}</em>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.orbitCaption} aria-hidden="true">
        <span>OPERATIONAL ORBIT</span>
        <i />
        <span>{execution.percentage}% EXEC</span>
      </div>
    </div>
  );
}
