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
): OrbFrame {
  const sphere = Math.max(0, Math.min(1, roundness));
  const gleam = Math.max(0, Math.min(1, sparkle));
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
      // Faint spherical envelope: the contour emerges from dots only.
      dots.push({
        x, y, z,
        r: (size === 20 ? 0.24 : 0.28) + 0.19 * depth,
        white: 0.79 - 0.37 * depth,
        a: sphere * (0.10 + 0.34 * depth),
      });
    }
  }

  for (const dot of source.dots) {
    // Native moving particles have no explicit alpha; ghost trails do.
    if (gleam === 0 || dot.a !== undefined) {
      dots.push(dot);
      continue;
    }
    const wave = (1 + Math.sin(t * 3.4 + dot.x * 0.41 + dot.y * 0.71 + dot.z * 0.18)) * 0.5;
    const gleaming = wave ** 13 * gleam;
    if (gleaming > 0.018) {
      dots.push({
        ...dot,
        z: dot.z - 0.0001,
        r: dot.r * (1.7 + 0.3 * gleaming),
        white: 0.23,
        a: 0.19 * gleaming,
      });
    }
    dots.push({
      ...dot,
      white: Math.max(0.008, dot.white - 0.30 * gleaming),
      r: dot.r * (1 + 0.33 * gleaming),
    });
  }
  dots.sort((a, b) => a.z - b.z);
  return { dots, lines: source.lines };
}
