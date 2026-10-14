'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './EmprovexBorderBeam.module.css';

export type EmprovexBeamVariant = 'travel' | 'focus' | 'static';
export type EmprovexBeamIntensity = 'low' | 'medium' | 'high';
export type EmprovexBeamTheme = 'dark' | 'light';

export interface EmprovexBorderBeamProps {
  children: ReactNode;
  /** travel: orbital accent; focus: visible only while a descendant has keyboard focus; static: no animation. */
  variant?: EmprovexBeamVariant;
  /** Recommended default: low. High is reserved for visual comparison, not routine UI. */
  intensity?: EmprovexBeamIntensity;
  /** Deliberately slow: clamped to 10–60 seconds per circuit. */
  duration?: number;
  /** Turning off stops animation and removes only the moving highlight. */
  active?: boolean;
  theme?: EmprovexBeamTheme;
  /** Matches the wrapped surface; in CSS pixels. */
  borderRadius?: number;
  /** Forces reduced motion independently of the OS preference. */
  reducedMotion?: boolean;
  /** Pause when outside the viewport. */
  pauseWhenOffscreen?: boolean;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

const OPACITY: Record<EmprovexBeamIntensity, number> = {
  low: 0.28,
  medium: 0.48,
  high: 0.68,
};

const clamp = (value: number, minimum: number, maximum: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;

type BeamStyle = CSSProperties & {
  '--emprovex-beam-radius': string;
  '--emprovex-beam-duration': string;
  '--emprovex-beam-opacity': number;
};

/**
 * Institutional, monochrome CSS interpretation of the Border Beam pattern.
 * No external dependency, animation loop, operational data or overlay portal.
 * Decoration is kept behind focus/menus and never receives pointer events.
 *
 * Technique studied: Jakub Antalik, border-beam (MIT),
 * https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/border-beam
 */
export function EmprovexBorderBeam({
  children,
  variant = 'travel',
  intensity = 'low',
  duration = 24,
  active = true,
  theme = 'dark',
  borderRadius = 16,
  reducedMotion = false,
  pauseWhenOffscreen = true,
  className,
  style,
  testId,
}: EmprovexBorderBeamProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inViewport, setInViewport] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    if (!pauseWhenOffscreen || !active || variant !== 'travel' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), {
      rootMargin: '80px',
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [active, pauseWhenOffscreen, variant]);

  useEffect(() => {
    const syncVisibility = () => setPageVisible(document.visibilityState === 'visible');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  const visible = active && (variant !== 'travel' || !pauseWhenOffscreen || inViewport);
  const playing = visible && pageVisible && variant === 'travel' && !reducedMotion;
  const beamStyle: BeamStyle = {
    ...style,
    '--emprovex-beam-radius': `${clamp(borderRadius, 0, 64, 16)}px`,
    '--emprovex-beam-duration': `${clamp(duration, 10, 60, 24)}s`,
    '--emprovex-beam-opacity': OPACITY[intensity],
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={beamStyle}
      data-emprovex-beam="true"
      data-beam-theme={theme}
      data-beam-variant={variant}
      data-beam-active={active ? 'true' : 'false'}
      data-beam-visible={visible ? 'true' : 'false'}
      data-beam-playing={playing ? 'true' : 'false'}
      data-beam-reduced={reducedMotion ? 'true' : 'false'}
      data-testid={testId}
    >
      <div className={styles.content}>{children}</div>
    </div>
  );
}
