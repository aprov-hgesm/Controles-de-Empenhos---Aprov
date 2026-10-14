'use client';

import { useEffect, useRef } from 'react';
import styles from './EmprovexThinkingOrb.module.css';

export type ThinkingOrbSize = 'hero' | 'large' | 'medium' | 'small' | 'mini';
export type ThinkingOrbPerformance = 'full' | 'balanced' | 'static';

export interface EmprovexThinkingOrbProps {
  size?: ThinkingOrbSize;
  performance?: ThinkingOrbPerformance;
  interactive?: boolean;
  paused?: boolean;
  state?: 'decorative' | 'loading';
  label?: string;
  className?: string;
}

/**
 * Prototipo VISUAL-R1. Sem requisicoes, sem estado de dados e sem WebGL/Canvas.
 * A variante decorativa e silenciosa para leitores de tela; loading tem status.
 * A interacao reage apenas ao ponteiro fino, com rAF sob demanda.
 */
export function EmprovexThinkingOrb({
  size = 'hero',
  performance = 'full',
  interactive = false,
  paused = false,
  state = 'decorative',
  label = 'Carregando',
  className,
}: EmprovexThinkingOrbProps) {
  const orbRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = orbRef.current;
    if (!root) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const motionAllowed = () =>
      interactive
      && performance === 'full'
      && !paused
      && document.visibilityState === 'visible'
      && finePointer.matches
      && !reducedMotion.matches;

    const apply = () => {
      root.style.setProperty('--orb-pointer-x', `${(currentX * 4.5).toFixed(2)}px`);
      root.style.setProperty('--orb-pointer-y', `${(currentY * 4.5).toFixed(2)}px`);
    };

    const reset = () => {
      targetX = 0;
      targetY = 0;
      currentX = 0;
      currentY = 0;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      apply();
    };

    const step = () => {
      frame = 0;
      if (!motionAllowed()) {
        reset();
        return;
      }
      currentX += (targetX - currentX) * 0.16;
      currentY += (targetY - currentY) * 0.16;
      if (
        Math.abs(currentX - targetX) < 0.002
        && Math.abs(currentY - targetY) < 0.002
      ) {
        currentX = targetX;
        currentY = targetY;
      }
      apply();
      if (currentX !== targetX || currentY !== targetY) {
        frame = window.requestAnimationFrame(step);
      }
    };

    const schedule = () => {
      if (!frame && motionAllowed()) frame = window.requestAnimationFrame(step);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!motionAllowed()) return;
      const rect = root.getBoundingClientRect();
      targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2));
      targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2));
      schedule();
    };

    const onVisibilityChange = () => {
      root.dataset.hidden = document.visibilityState === 'visible' ? 'false' : 'true';
      if (!motionAllowed()) reset();
    };
    const onMotionChange = () => {
      if (!motionAllowed()) reset();
    };

    root.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', onMotionChange);
    finePointer.addEventListener('change', onMotionChange);
    onVisibilityChange();

    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onMotionChange);
      finePointer.removeEventListener('change', onMotionChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [interactive, paused, performance]);

  const loading = state === 'loading';

  return (
    <span
      ref={orbRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-size={size}
      data-performance={performance}
      data-paused={paused ? 'true' : 'false'}
      data-interactive={interactive ? 'true' : 'false'}
      data-state={state}
      data-hidden="false"
      aria-hidden={loading ? undefined : true}
      role={loading ? 'status' : undefined}
      aria-live={loading ? 'polite' : undefined}
      aria-label={loading ? label : undefined}
    >
      <span className={styles.aura} aria-hidden="true" />
      <span className={styles.outerRing} aria-hidden="true" />
      <span className={styles.satelliteA} aria-hidden="true" />
      <span className={styles.satelliteB} aria-hidden="true" />
      <span className={styles.satelliteC} aria-hidden="true" />
      <span className={styles.shell} aria-hidden="true">
        <span className={styles.fluidA} />
        <span className={styles.fluidB} />
        <span className={styles.fluidC} />
        <span className={styles.specular} />
      </span>
      <span className={styles.spark} aria-hidden="true" />
    </span>
  );
}
