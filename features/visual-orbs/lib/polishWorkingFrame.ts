import { fibDir, makeProj, type Dot, type OrbFrame } from '../vendor/thinking-orbs/engine/core';

/**
 * Optional EMPROVEX finishing layer for the original 'working' mode.
 * Upstream geometry/presets are not changed. Additional marks are discrete,
 * monochrome circles; there are no paths, filters, gradients or WebGL.
 */
export function polishWorkingFrame(
  source: OrbFrame,
  size: 20 | 64,
  t: number,
  roundness: number,
  sparkle: number,
  /** Only the colorful Início hero receives a stronger dotted outer shell. */
  shellEmphasis = 0,
  refinement: 'classic' | 'r2' = 'classic',
): OrbFrame {
  const sphere = Math.max(0, Math.min(1, roundness));
  const gleam = Math.max(0, Math.min(1, sparkle));
  const outerLift = Math.max(0, Math.min(1, shellEmphasis));
  const institutional = refinement === 'r2';
  if (sphere === 0 && gleam === 0) return source;

  const dots: Dot[] = [];
  if (sphere > 0) {
    const n = size === 20 ? 52 : 196;
    const radius = (size / 2) * 0.82;
    const project = makeProj(t * 0.12, 0.3, size / 2, size / 2, radius);
    for (let i = 0; i < n; i++) {
      const [dx, dy, dz] = fibDir(i, n);
      const [x, y, z] = project(dx, dy, dz);
      const depth = (z / radius + 1) * 0.5;
      // Accentuate the silhouette, not the center: only the additive Fibonacci
      // dots change. The original 3D orbit geometry and depth remain intact.
      const projectedRadius = Math.hypot(x - size / 2, y - size / 2) / radius;
      const silhouette = Math.max(0, Math.min(1, (projectedRadius - 0.42) / 0.58));
      const shellAlpha = sphere * (0.10 + 0.34 * depth);
      if (institutional) {
        // Keep the Fibonacci directions fixed, but suppress about one quarter of
        // interior background marks. The outer contour stays articulated by dots.
        if (silhouette < 0.76 && (i * 13 + 7) % 7 < 2) continue;
        const frontLighting = 0.42 + 0.65 * depth;
        const rimLighting = 0.72 + 0.75 * silhouette;
        dots.push({
          x, y, z,
          r: ((size === 20 ? 0.24 : 0.28) + 0.19 * depth)
            * (0.84 + 0.12 * depth + 0.18 * silhouette),
          white: 0.79 - 0.37 * depth + 0.04 * (1 - depth) - 0.045 * silhouette,
          a: Math.min(0.52, shellAlpha * frontLighting * rimLighting),
        });
      } else {
        dots.push({
          x, y, z,
          r: (size === 20 ? 0.24 : 0.28) + 0.19 * depth
            + outerLift * (0.035 + 0.085 * silhouette),
          white: 0.79 - 0.37 * depth - outerLift * (0.025 + 0.085 * silhouette),
          a: Math.min(0.58, shellAlpha * (1 + outerLift * (0.30 + 0.62 * silhouette))),
        });
      }
    }
  }

  for (const dot of source.dots) {
    // Native moving particles have no explicit alpha; ghost trails do.
    if (gleam === 0 || dot.a !== undefined) {
      dots.push(dot);
      continue;
    }
    // R2 twinkles last longer and peak less sharply, so they read as precise
    // light points rather than confetti. The classic algorithm is preserved.
    const wave = institutional
      ? (1 + Math.sin(t * 1.85 + dot.x * 0.23 + dot.y * 0.17 + dot.z * 0.33)) * 0.5
      : (1 + Math.sin(t * 3.4 + dot.x * 0.41 + dot.y * 0.71 + dot.z * 0.18)) * 0.5;
    const gleaming = (wave ** (institutional ? 7 : 13)) * gleam;
    if (gleaming > 0.018) {
      dots.push({
        ...dot,
        z: dot.z - 0.0001,
        r: dot.r * (institutional ? 1.38 + 0.18 * gleaming : 1.7 + 0.3 * gleaming),
        white: 0.23,
        a: (institutional ? 0.11 : 0.19) * gleaming,
      });
    }
    dots.push({
      ...dot,
      white: Math.max(0.008, dot.white - (institutional ? 0.14 : 0.30) * gleaming),
      r: dot.r * (institutional
        ? 0.82 + 0.09 * gleaming
        : 1 + 0.33 * gleaming),
    });
  }
  dots.sort((a, b) => a.z - b.z);
  return { dots, lines: source.lines };
}
