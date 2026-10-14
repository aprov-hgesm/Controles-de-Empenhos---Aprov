'use client';

import { EmprovexThinkingOrb, type ThinkingOrbSize } from '@/features/visual-orbs/components/EmprovexThinkingOrb';
import type { OrbRendererProps } from './orbLoaderContract';

/**
 * VISUAL-INTEGRATION-QA-01: bridges W2's layout-only contract to the W1 engine.
 * The W1 engine has no density/intensity/pixelSize parameter. Those W2 visual
 * hints must not be passed to the Canvas renderer or change 20/64 presets.
 * W1 is monochromatic at the sourced commit; await certified colored HEAD.
 */
const W1_DIAMETERS: Record<ThinkingOrbSize, number> = {
  hero: 136, large: 116, medium: 72, small: 42, mini: 20,
};

export function EmprovexThinkingOrbRenderer({
  size, pixelSize, speed, paused, performance, surface = 'light',
}: OrbRendererProps) {
  const nativePixels = W1_DIAMETERS[size];
  const scale = Math.max(0.1, Math.min(4, pixelSize / nativePixels));
  return (
    <span
      data-testid="visual-r1-orb-adapter"
      data-orb-source="w1-thinking-orbs"
      data-w1-diameter={nativePixels}
      data-w2-diameter={pixelSize}
      aria-hidden="true"
      style={{
        display: 'inline-flex', width: pixelSize, height: pixelSize,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{
        display: 'inline-flex', flex: 'none', width: nativePixels,
        height: nativePixels, transform: `scale(${scale})`,
        transformOrigin: 'center',
      }}>
        <EmprovexThinkingOrb
          size={size}
          performance={performance}
          paused={paused}
          state="decorative"
          animation="working"
          speed={speed}
          roundness={0.72}
          sparkle={0.68}
          contrastSurface={surface === 'light' ? 'matte' : 'transparent'}
        />
      </span>
    </span>
  );
}
