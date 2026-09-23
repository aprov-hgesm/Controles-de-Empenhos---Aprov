'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import type { InicioOperationalSnapshot } from '../domain/homeOperationalSnapshot';
import styles from './InicioCore.module.css';

interface InicioCoreProps {
  snapshot: InicioOperationalSnapshot | null;
  totalEmpenhos: number;
  totalValueLabel: string;
  activeAlertCount: number;
  interactiveMotion: boolean;
}

export function InicioCore({
  snapshot,
  totalEmpenhos,
  totalValueLabel,
  activeAlertCount,
  interactiveMotion,
}: InicioCoreProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion || !interactiveMotion) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    if (!finePointer.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const apply = () => {
      root.style.setProperty('--core-shift-x', `${(currentX * 5.5).toFixed(2)}px`);
      root.style.setProperty('--core-shift-y', `${(currentY * 4.2).toFixed(2)}px`);
      root.style.setProperty('--core-rotate-x', `${(currentY * -5.2).toFixed(2)}deg`);
      root.style.setProperty('--core-rotate-y', `${(currentX * 6.4).toFixed(2)}deg`);
      root.style.setProperty('--core-light-x', `${(50 + currentX * 18).toFixed(1)}%`);
      root.style.setProperty('--core-light-y', `${(42 + currentY * 15).toFixed(1)}%`);
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.11;
      currentY += (targetY - currentY) * 0.11;
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
      const rect = root.getBoundingClientRect();
      const normalizedX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      const normalizedY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      targetX = Math.max(-1, Math.min(1, normalizedX));
      targetY = Math.max(-1, Math.min(1, normalizedY));
      scheduleFrame();
    };

    const reset = () => {
      targetX = 0;
      targetY = 0;
      scheduleFrame();
    };

    root.addEventListener('pointermove', handlePointerMove, { passive: true });
    root.addEventListener('pointerleave', reset);
    root.addEventListener('blur', reset);

    return () => {
      root.removeEventListener('pointermove', handlePointerMove);
      root.removeEventListener('pointerleave', reset);
      root.removeEventListener('blur', reset);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [interactiveMotion, reduceMotion]);

  const density = useMemo(
    () => Math.min(1, Math.log10(Math.max(totalEmpenhos, 1) + 1) / 2.3),
    [totalEmpenhos]
  );

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
  const classStats = ['QR', 'CALI', 'PASA', 'FUNADOM'].map((code) =>
    snapshot?.classStats.find((item) => item.code === code) ?? {
      code,
      count: 0,
      value: 0,
    }
  );
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <motion.div
      ref={rootRef}
      className={styles.root}
      data-alert={activeAlertCount > 0 ? 'true' : 'false'}
      data-static-core="true"
      data-inicio-star-exclusion="core"
      tabIndex={0}
      role="group"
      aria-label={`Núcleo EMPROVEX. ${totalEmpenhos} empenhos cadastrados, ${totalValueLabel} empenhados.`}
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.78, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        ['--core-density' as string]: density.toFixed(3),
      }}
    >
      <span className={styles.corona} aria-hidden="true" />
      <span className={styles.commandHalo} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className={styles.field} aria-hidden="true">
        <span className={`${styles.orbit} ${styles.orbitA}`}><i /></span>
        <span className={`${styles.orbit} ${styles.orbitB}`}><i /></span>
        <span className={`${styles.orbit} ${styles.orbitC}`}><i /></span>
        <span className={styles.pulseRing} />
        <span className={styles.telemetryArc} />
        <span className={styles.commandArcA} />
        <span className={styles.commandArcB} />
      </span>

      <span className={styles.reactor}>
        <span className={styles.reactorGrid} aria-hidden="true" />
        <span className={styles.reactorShell} aria-hidden="true" />
        <span className={styles.reactorGlow} aria-hidden="true" />
        <span className={styles.energyFilaments} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={styles.logoPlate} aria-hidden="true">
          <span className={styles.apertureRing} />
          <span className={styles.energyCore} />
        </span>
        <span className={styles.specular} aria-hidden="true" />
        <span className={styles.centerPulse} aria-hidden="true" />
      </span>

      <span className={styles.statusRing} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>

      <span className={styles.tooltip}>
        <span className={styles.telemetryHeader}>
          <strong>Núcleo EMPROVEX</strong>
          <small>{totalEmpenhos} empenhos · {totalValueLabel}</small>
        </span>

        <span className={styles.telemetryGrid}>
          <span className={styles.telemetryCard}>
            <b>Avisos</b>
            <strong>{alertSeverity.total}</strong>
            <small>
              {alertSeverity.critical} crítico(s) · {alertSeverity.attention} atenção
            </small>
          </span>

          <span className={styles.telemetryCard}>
            <b>Recebimentos</b>
            <strong>{receiving.pendingEmpenhos} empenho(s)</strong>
            <small>
              {receiving.pendingItems} item(ns) · {formatCurrency(receiving.balance)}
            </small>
          </span>

          <span className={styles.telemetryCard}>
            <b>Execução</b>
            <strong>{execution.percentage}%</strong>
            <small>
              {formatCurrency(execution.received)} de {formatCurrency(execution.committed)}
            </small>
          </span>

          <span className={styles.telemetryCard}>
            <b>Painel</b>
            <strong>Visão analítica</strong>
            <small>Saldos, filtros e indicadores detalhados</small>
          </span>
        </span>

        <span className={styles.classTelemetry}>
          <b>Classes de empenho</b>
          <span className={styles.classTelemetryGrid}>
            {classStats.map((item) => (
              <span key={item.code}>
                <strong>{item.code}</strong>
                <small>{item.count} empenho(s)</small>
                <em>{formatCurrency(item.value)}</em>
              </span>
            ))}
          </span>
        </span>
      </span>
    </motion.div>
  );
}
