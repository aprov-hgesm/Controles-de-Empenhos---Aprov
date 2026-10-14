import { hashD, makeProj, paintLines, type OrbFrame } from '../vendor/thinking-orbs/engine/core';
import type { ModeOpts } from '../vendor/thinking-orbs/engine/profiles';

/**
 * EMPROVEX paint-only color layer. The upstream MIT geometry, profiles and
 * painter are left unchanged. Orbit/moving-point identities are reconstructed
 * from the deterministic upstream orbit formulas, not guessed from velocity
 * between rendered frames or inferred from their depth-sorted array positions.
 */
export const ORB_COLORS = {
  slow: '#FFFFFF',
  fastYellow: '#FFD25A',
  fastRed: '#FF5A46',
} as const;

export const FAST_ORBIT_THRESHOLD = 0.54;

export type OrbMovingColor = 'slow' | 'fastYellow' | 'fastRed';

interface MovingParticle {
  id: string;
  speed: number;
  position: string;
}

const keyOf = (x: number, y: number, z: number) =>
  `${x.toFixed(5)}:${y.toFixed(5)}:${z.toFixed(5)}`;

/** Reproduce moving-point identities; do not mutate the upstream frames. */
function movingParticles(size: 20 | 64, t: number, opts: ModeOpts): MovingParticle[] {
  const cx = size / 2;
  const radius = cx * 0.82;
  const project = makeProj(t * 0.12, 0.3, cx, cx, 1);
  const orbitCount = opts.orbitN ?? 12;
  const particlesPerOrbit = opts.particles ?? 3;
  const result: MovingParticle[] = [];

  for (let orbit = 0; orbit < orbitCount; orbit++) {
    const h1 = hashD(orbit, 1.7);
    const h2 = hashD(orbit, 5.2);
    const h3 = hashD(orbit, 8.9);
    const orbitRadius = radius * (0.45 + 0.52 * h1);
    const theta = h1 * 2 * Math.PI;
    const phi = Math.acos(2 * h2 - 1);
    const nx = Math.sin(phi) * Math.cos(theta);
    const ny = Math.cos(phi);
    const nz = Math.sin(phi) * Math.sin(theta);
    let ux = -ny;
    let uy = nx;
    const uz = 0;
    const len = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy));
    ux /= len;
    uy /= len;
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;
    const speed = (0.25 + 0.55 * h3) * (h3 > 0.5 ? 1 : -1);

    for (let particle = 0; particle < particlesPerOrbit; particle++) {
      const angle = t * speed + (particle / particlesPerOrbit) * 2 * Math.PI + h2 * 6;
      const [x, y, z] = project(
        (ux * Math.cos(angle) + vx * Math.sin(angle)) * orbitRadius,
        (uy * Math.cos(angle) + vy * Math.sin(angle)) * orbitRadius,
        (uz * Math.cos(angle) + vz * Math.sin(angle)) * orbitRadius
      );
      result.push({ id: `${orbit}:${particle}`, speed: Math.abs(speed), position: keyOf(x, y, z) });
    }
  }
  return result;
}

/** Exactly 70/30 to the nearest particle, stable across frames and animation speed. */
export function resolveOrbColorDistribution(
  size: 20 | 64, t: number, opts: ModeOpts
): Map<string, OrbMovingColor> {
  const particles = movingParticles(size, t, opts);
  const fast = particles.filter((particle) => particle.speed >= FAST_ORBIT_THRESHOLD);
  const reds = new Set(
    [...fast].sort((a, b) => {
      const [orbA, partA] = a.id.split(':').map(Number);
      const [orbB, partB] = b.id.split(':').map(Number);
      const ha = hashD(orbA + 71, partA + 19);
      const hb = hashD(orbB + 71, partB + 19);
      return ha - hb || a.id.localeCompare(b.id);
    }).slice(0, Math.round(fast.length * 0.3)).map((particle) => particle.id)
  );
  return new Map<string, OrbMovingColor>(particles.map((particle): [string, OrbMovingColor] => [
    particle.position,
    particle.speed < FAST_ORBIT_THRESHOLD
      ? 'slow'
      : reds.has(particle.id) ? 'fastRed' : 'fastYellow',
  ]));
}

const RGB: Record<OrbMovingColor, string> = {
  slow: '255,255,255',
  fastYellow: '255,210,90',
  fastRed: '255,90,70',
};

/**
 * Draw exact upstream circles and their original z-order. The Fibonacci shell
 * and ghost trails remain neutral. Sparkle halos reuse their moving particle's
 * fixed tint; all eight other modes still use the original upstream painter.
 */
export function paintColorWorkingFrame(
  ctx: CanvasRenderingContext2D,
  frame: OrbFrame,
  size: 20 | 64,
  t: number,
  opts: ModeOpts,
  refinement: 'classic' | 'r2' = 'classic',
): void {
  if (frame.lines.length) paintLines(ctx, frame.lines, true);
  const colors = resolveOrbColorDistribution(size, t, opts);

  for (const dot of frame.dots) {
    // Polish places each sparkle halo 0.0001 behind its source particle.
    // Match the parent's stable identity rather than leaving halos untinted.
    const isGlow = dot.a !== undefined && Math.abs(dot.white - 0.23) < 0.00001;
    const isMoving = dot.a === undefined;
    const color = isMoving || isGlow
      ? colors.get(keyOf(dot.x, dot.y, isGlow ? dot.z + 0.0001 : dot.z))
      : undefined;
    const alpha = dot.a ?? 1;
    if (color) {
      // Keep the 70/30 palette but tame saturated peak highlights a little.
      // Slow white particles and neutral shell stay untouched.
      const balancedAlpha = refinement === 'r2'
        ? alpha * (color === 'slow' ? 0.94 : 0.89)
        : color === 'slow' ? alpha : alpha * 0.94;
      ctx.fillStyle = `rgba(${RGB[color]},${balancedAlpha})`;
    } else {
      // On the colored Início R2, structural marks and orbital ghost paths
      // use the same WHITE pigment. Depth is expressed through opacity, not
      // silver/grey ink. The classic painter is unchanged for comparison.
      const whiteStructure = refinement === 'r2' && dot.a !== undefined && !isGlow;
      const gray = whiteStructure
        ? 255
        : Math.round((1 - Math.max(0, Math.min(1, dot.white))) * 255);
      const ghostTrail = whiteStructure && Math.abs(dot.white - 0.72) < 0.00001;
      const inkAlpha = ghostTrail ? alpha * 0.58 : alpha;
      ctx.fillStyle = `rgba(${gray},${gray},${gray},${inkAlpha})`;
    }
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
