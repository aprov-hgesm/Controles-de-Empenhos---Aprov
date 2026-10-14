import type { ComponentType } from 'react';

export type OrbLoaderSize = 'hero' | 'large' | 'medium' | 'small' | 'mini';
export type OrbLoaderPerformance = 'full' | 'balanced' | 'static';

export interface OrbRendererProps {
  size: OrbLoaderSize;
  pixelSize: number;
  density: number;
  speed: number;
  intensity: number;
  paused: boolean;
}

export type OrbRenderer = ComponentType<OrbRendererProps>;

interface OrbSizeProfile {
  pixelSize: number;
  density: number;
  speed: number;
  intensity: number;
}

const SIZE_PROFILES: Record<OrbLoaderSize, OrbSizeProfile> = {
  hero: { pixelSize: 160, density: 1, speed: 1, intensity: 1 },
  large: { pixelSize: 104, density: 0.86, speed: 0.94, intensity: 0.96 },
  medium: { pixelSize: 64, density: 0.7, speed: 0.86, intensity: 0.9 },
  small: { pixelSize: 40, density: 0.52, speed: 0.78, intensity: 0.84 },
  mini: { pixelSize: 20, density: 0.35, speed: 0.7, intensity: 0.76 },
};

const PERFORMANCE_FACTORS: Record<
  OrbLoaderPerformance,
  { density: number; speed: number; intensity: number }
> = {
  full: { density: 1, speed: 1, intensity: 1 },
  balanced: { density: 0.78, speed: 0.85, intensity: 0.86 },
  static: { density: 0.5, speed: 0, intensity: 0.72 },
};

/**
 * Presentation-only hints. The W1 adapter owns Canvas rendering and may map
 * the requested diameter to its approved 20/64 pixel or expanded implementation.
 * No data requests, timers, or artificial progress are created here.
 */
export function resolveOrbLoaderProfile(
  size: OrbLoaderSize,
  performance: OrbLoaderPerformance,
  paused: boolean
): OrbRendererProps {
  const variant = SIZE_PROFILES[size];
  const factors = PERFORMANCE_FACTORS[performance];
  return {
    size,
    pixelSize: variant.pixelSize,
    density: Number((variant.density * factors.density).toFixed(3)),
    speed: paused ? 0 : Number((variant.speed * factors.speed).toFixed(3)),
    intensity: Number((variant.intensity * factors.intensity).toFixed(3)),
    paused: paused || performance === 'static',
  };
}
