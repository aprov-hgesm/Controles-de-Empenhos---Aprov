'use client';

import { useEffect, useRef } from 'react';

import { LoginNetwork } from './LoginNetwork';

export type LoginAmbientFocus = 'email' | 'password' | null;
export type LoginAmbientState = 'idle' | 'ready' | 'authenticating' | 'error';

interface LoginAtmosphereProps {
  focus?: LoginAmbientFocus;
  state?: LoginAmbientState;
}

const documentSignals = [
  { label: 'NE 2026••••', x: '13%', y: '18%', delay: '0s' },
  { label: 'NF ••••••', x: '76%', y: '22%', delay: '-2.8s' },
  { label: 'TR / REC', x: '18%', y: '64%', delay: '-4.6s' },
  { label: 'LIQ', x: '68%', y: '71%', delay: '-1.4s' },
  { label: 'DOC / XML', x: '46%', y: '12%', delay: '-5.1s' },
  { label: 'CRN / EXEC', x: '83%', y: '55%', delay: '-3.4s' },
];

export function LoginAtmosphere({
  focus = null,
  state = 'idle',
}: LoginAtmosphereProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (!finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    let targetX = window.innerWidth * 0.58;
    let targetY = window.innerHeight * 0.36;
    let currentX = targetX;
    let currentY = targetY;

    const render = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const normalizedX = (currentX / viewportWidth - 0.5) * 2;
      const normalizedY = (currentY / viewportHeight - 0.5) * 2;

      root.style.setProperty('--spot-x', `${currentX}px`);
      root.style.setProperty('--spot-y', `${currentY}px`);
      root.style.setProperty('--ambient-shift-x', `${(normalizedX * 7).toFixed(2)}px`);
      root.style.setProperty('--ambient-shift-y', `${(normalizedY * 5).toFixed(2)}px`);
      root.style.setProperty('--ambient-shift-x-inverse', `${(normalizedX * -4).toFixed(2)}px`);
      root.style.setProperty('--ambient-shift-y-inverse', `${(normalizedY * -3).toFixed(2)}px`);

      frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const handlePointerLeave = () => {
      targetX = window.innerWidth * 0.58;
      targetY = window.innerHeight * 0.36;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-focus={focus ?? 'none'}
      data-state={state}
      className="emprovex-login-atmosphere pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="emprovex-login-spotlight absolute inset-0" />
      <div className="emprovex-login-attention-field absolute inset-0" />

      <div className="emprovex-login-aura-layer absolute inset-0">
        <div className="emprovex-login-aura emprovex-login-aura--one absolute -left-[12rem] -top-[10rem] h-[34rem] w-[34rem] rounded-full" />
        <div className="emprovex-login-aura emprovex-login-aura--two absolute -bottom-[14rem] right-[4%] h-[38rem] w-[38rem] rounded-full" />
        <div className="emprovex-login-aura emprovex-login-aura--three absolute left-[44%] top-[28%] h-[22rem] w-[22rem] rounded-full" />
      </div>

      <div className="emprovex-login-perspective-grid absolute inset-x-[-16%] bottom-[-28%] h-[68%]" />

      <div className="emprovex-login-network-layer absolute inset-0 hidden md:block">
        <LoginNetwork />
      </div>

      <div className="emprovex-login-document-layer absolute inset-0 hidden lg:block">
        {documentSignals.map((signal) => (
          <span
            key={signal.label}
            className="emprovex-document-signal absolute font-mono text-[9px] font-medium uppercase tracking-[0.20em] text-blue-200/25"
            style={{ left: signal.x, top: signal.y, animationDelay: signal.delay }}
          >
            {signal.label}
          </span>
        ))}
      </div>

      <div className="emprovex-login-scanline absolute inset-x-0 top-[21%] hidden h-px lg:block" />
      <div className="emprovex-login-grain absolute inset-0" />
    </div>
  );
}
