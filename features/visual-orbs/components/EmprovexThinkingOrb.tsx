'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { paintFrame } from '../vendor/thinking-orbs/engine/core';
import { paintColorWorkingFrame } from '../lib/colorWorkingFrame';
import { MODE_FRAMES } from '../vendor/thinking-orbs/engine/registry';
import { polishWorkingFrame } from '../lib/polishWorkingFrame';
import { resolvePreset } from '../vendor/thinking-orbs/presets';
import type { OrbState } from '../vendor/thinking-orbs/types';
import styles from './EmprovexThinkingOrb.module.css';

export type ThinkingOrbSize = 'hero' | 'large' | 'medium' | 'small' | 'mini';
export type ThinkingOrbPerformance = 'full' | 'balanced' | 'static';

export interface EmprovexThinkingOrbProps {
  size?: ThinkingOrbSize;
  performance?: ThinkingOrbPerformance;
  interactive?: boolean;
  paused?: boolean;
  state?: 'decorative' | 'loading';
  /** Native Thinking Orbs animation. 'working' is the original dotted orbital effect. */
  animation?: OrbState;
  /** Multiplier applied to the upstream state preset; default preserves original timing. */
  speed?: number;
  /** Subtle dotted spherical envelope; 0 preserves upstream working geometry. */
  roundness?: number;
  /** White particle twinkles; 0 reproduces the upstream matte ink. */
  sparkle?: number;
  /** Colored orbital particles are reserved for the central Início feature. */
  palette?: 'monochrome' | 'colored';
  /** Monochrome ink adapts to the host background without extra backdrops. */
  surface?: 'light' | 'dark';
  label?: string;
  className?: string;
}

const SIZE_PIXELS: Record<ThinkingOrbSize, number> = {
  hero: 136,
  large: 116,
  medium: 72,
  small: 42,
  mini: 20,
};

/**
 * VISUAL-ORB-CORE-01: original MIT-licensed Thinking Orbs geometry/presets.
 * Source preserved at ../vendor/thinking-orbs/, with attribution and license.
 *
 * The upstream 64px/20px tunings remain unchanged. We scale the Canvas 2D
 * coordinate system to the host's actual CSS size, preserving dot count,
 * geometry, depth and ink (rather than drawing gradient spheres).
 * This is an isolated candidate: it is NOT mounted in InicioCore yet.
 */
export function EmprovexThinkingOrb({
  size = 'hero',
  performance: performanceMode = 'full',
  interactive = false,
  paused = false,
  state = 'decorative',
  animation = 'working',
  speed = 1,
  roundness = 0.72,
  sparkle = 0.68,
  palette = 'monochrome',
  surface = 'dark',
  label = 'Carregando',
  className,
}: EmprovexThinkingOrbProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const presetSize: 20 | 64 = size === 'mini' || size === 'small' ? 20 : 64;
    const { mode, speed: nativeSpeed, opts } = resolvePreset(animation, presetSize);
    const nativeFrame = MODE_FRAMES[mode];
    const effectiveSpeed = nativeSpeed * Math.max(0, Math.min(3, speed));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');

    let raf = 0;
    let visible = true;
    let lastPaint = -Infinity;
    let clockSeconds = 0.6;
    let pointerX = 0;
    let pointerY = 0;

    const motionAllowed = () =>
      !paused &&
      performanceMode !== 'static' &&
      !reducedMotion.matches &&
      visible &&
      document.visibilityState === 'visible';

    const draw = () => {
      const cssSize = canvas.getBoundingClientRect().width || SIZE_PIXELS[size];
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pixels = Math.max(1, Math.round(cssSize * dpr));
      if (canvas.width !== pixels || canvas.height !== pixels) {
        canvas.width = pixels;
        canvas.height = pixels;
      }

      const factor = pixels / presetSize;
      context.setTransform(factor, 0, 0, factor, 0, 0);
      context.clearRect(0, 0, presetSize, presetSize);

      // A translation of <=1.8 physical pixels only; no new topology.
      const dx = interactive && finePointer.matches && !reducedMotion.matches
        ? pointerX * 1.8 / cssSize * presetSize : 0;
      const dy = interactive && finePointer.matches && !reducedMotion.matches
        ? pointerY * 1.8 / cssSize * presetSize : 0;
      context.translate(dx, dy);

      const source = nativeFrame(presetSize, clockSeconds, opts);
      const enhanced = animation === 'working'
        ? polishWorkingFrame(source, presetSize, clockSeconds, roundness, sparkle)
        : source;
      if (animation === 'working' && palette === 'colored') {
        paintColorWorkingFrame(context, enhanced, presetSize, clockSeconds, opts);
      } else {
        paintFrame(context, enhanced, surface === 'dark');
      }
    };

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!motionAllowed()) return;
      const interval = performanceMode === 'balanced' ? 50 : 1000 / 45;
      if (now - lastPaint >= interval) {
        clockSeconds = now / 1000 * effectiveSpeed;
        draw();
        lastPaint = now;
      }
      raf = window.requestAnimationFrame(loop);
    };

    const sync = () => {
      stop();
      if (reducedMotion.matches || performanceMode === 'static') clockSeconds = 0.6;
      if (document.visibilityState === 'visible') draw();
      if (motionAllowed()) raf = window.requestAnimationFrame(loop);
    };

    const pointerMove = (event: PointerEvent) => {
      if (!interactive || performanceMode !== 'full' ||
          !finePointer.matches || reducedMotion.matches) return;
      const bounds = host.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height) * 2 - 1));
      if (!motionAllowed()) draw();
    };

    const pointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
      if (!motionAllowed()) draw();
    };

    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        })
      : null;
    observer?.observe(host);

    const resize = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => draw())
      : null;
    resize?.observe(host);

    host.addEventListener('pointermove', pointerMove, { passive: true });
    host.addEventListener('pointerleave', pointerLeave);
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    finePointer.addEventListener('change', sync);
    sync();

    return () => {
      stop();
      observer?.disconnect();
      resize?.disconnect();
      host.removeEventListener('pointermove', pointerMove);
      host.removeEventListener('pointerleave', pointerLeave);
      document.removeEventListener('visibilitychange', sync);
      reducedMotion.removeEventListener('change', sync);
      finePointer.removeEventListener('change', sync);
    };
  }, [animation, interactive, paused, performanceMode, size, speed, roundness, sparkle, palette, surface]);

  const isLoading = state === 'loading';
  const orbStyle = { '--orb-size': `${SIZE_PIXELS[size]}px` } as CSSProperties;

  return (
    <span
      ref={hostRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={orbStyle}
      data-size={size}
      data-performance={performanceMode}
      data-paused={paused ? 'true' : 'false'}
      data-interactive={interactive ? 'true' : 'false'}
      data-animation={animation}
      data-orb-palette={palette}
      data-orb-surface={surface}
      data-testid="emprovex-thinking-orb"
      aria-hidden={isLoading ? undefined : true}
      role={isLoading ? 'status' : undefined}
      aria-live={isLoading ? 'polite' : undefined}
      aria-label={isLoading ? label : undefined}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </span>
  );
}
