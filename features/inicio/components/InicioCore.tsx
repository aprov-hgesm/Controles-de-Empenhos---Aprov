'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import styles from './InicioCore.module.css';

interface InicioCoreProps {
  customLogo: string | null;
  totalEmpenhos: number;
  totalValueLabel: string;
  activeAlertCount: number;
  onOpenEmpenhos: () => void;
}

export function InicioCore({
  customLogo,
  totalEmpenhos,
  totalValueLabel,
  activeAlertCount,
  onOpenEmpenhos,
}: InicioCoreProps) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotion) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    if (!finePointer.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.11;
      currentY += (targetY - currentY) * 0.11;

      root.style.setProperty('--core-shift-x', `${(currentX * 5.5).toFixed(2)}px`);
      root.style.setProperty('--core-shift-y', `${(currentY * 4.2).toFixed(2)}px`);
      root.style.setProperty('--core-rotate-x', `${(currentY * -5.2).toFixed(2)}deg`);
      root.style.setProperty('--core-rotate-y', `${(currentX * 6.4).toFixed(2)}deg`);
      root.style.setProperty('--core-light-x', `${(50 + currentX * 18).toFixed(1)}%`);
      root.style.setProperty('--core-light-y', `${(42 + currentY * 15).toFixed(1)}%`);

      frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const normalizedX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      const normalizedY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      targetX = Math.max(-1, Math.min(1, normalizedX));
      targetY = Math.max(-1, Math.min(1, normalizedY));
    };

    const reset = () => {
      targetX = 0;
      targetY = 0;
    };

    root.addEventListener('pointermove', handlePointerMove, { passive: true });
    root.addEventListener('pointerleave', reset);
    root.addEventListener('blur', reset);
    frame = window.requestAnimationFrame(render);

    return () => {
      root.removeEventListener('pointermove', handlePointerMove);
      root.removeEventListener('pointerleave', reset);
      root.removeEventListener('blur', reset);
      window.cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  const density = useMemo(
    () => Math.min(1, Math.log10(Math.max(totalEmpenhos, 1) + 1) / 2.3),
    [totalEmpenhos]
  );

  return (
    <motion.button
      ref={rootRef}
      type="button"
      className={styles.root}
      data-alert={activeAlertCount > 0 ? 'true' : 'false'}
      onClick={onOpenEmpenhos}
      aria-label={`Abrir empenhos. ${totalEmpenhos} empenhos cadastrados, ${totalValueLabel} empenhados.`}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.78, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        ['--core-density' as string]: density.toFixed(3),
      }}
    >
      <span className={styles.corona} aria-hidden="true" />
      <span className={styles.field} aria-hidden="true">
        <span className={`${styles.orbit} ${styles.orbitA}`}><i /></span>
        <span className={`${styles.orbit} ${styles.orbitB}`}><i /></span>
        <span className={`${styles.orbit} ${styles.orbitC}`}><i /></span>
        <span className={styles.pulseRing} />
        <span className={styles.telemetryArc} />
      </span>

      <span className={styles.reactor}>
        <span className={styles.reactorGrid} aria-hidden="true" />
        <span className={styles.reactorGlow} aria-hidden="true" />
        <span className={styles.logoPlate}>
          {customLogo ? (
            <Image
              src={customLogo}
              alt=""
              width={152}
              height={152}
              unoptimized
              priority
              className={styles.logo}
            />
          ) : (
            <span className={styles.fallback}>EMP</span>
          )}
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
        <strong>Núcleo EMPROVEX</strong>
        <span>{totalEmpenhos} empenhos cadastrados</span>
        <small>{totalValueLabel} empenhados</small>
        <em>{activeAlertCount > 0 ? `${activeAlertCount} alerta(s) ativos no ambiente` : 'Operação sem alertas ativos'}</em>
      </span>
    </motion.button>
  );
}
