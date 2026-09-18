'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type LoginLogoVisualState = 'idle' | 'authenticating' | 'success' | 'error';

interface LoginLogoCoreProps {
  customLogo: string | null;
  state: LoginLogoVisualState;
}

export function LoginLogoCore({ customLogo, state }: LoginLogoCoreProps) {
  const rootRef = useRef<HTMLDivElement>(null);
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
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;

      root.style.setProperty('--logo-shift-x', `${currentX * 5}px`);
      root.style.setProperty('--logo-shift-y', `${currentY * 4}px`);
      root.style.setProperty('--logo-rotate-x', `${currentY * -2.8}deg`);
      root.style.setProperty('--logo-rotate-y', `${currentX * 3.4}deg`);

      frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      targetY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handlePointerLeave);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('mouseleave', handlePointerLeave);
      window.cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return (
    <motion.div
      ref={rootRef}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.82, rotate: -4 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.88, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="emprovex-logo-core"
      data-state={state}
      aria-label="Identidade visual EMPROVEX"
    >
      <div className="emprovex-logo-core__halo emprovex-logo-core__halo--outer" />
      <div className="emprovex-logo-core__halo emprovex-logo-core__halo--inner" />

      <div className="emprovex-logo-core__orbit emprovex-logo-core__orbit--a">
        <span />
      </div>
      <div className="emprovex-logo-core__orbit emprovex-logo-core__orbit--b">
        <span />
      </div>

      <div className="emprovex-logo-core__bracket emprovex-logo-core__bracket--tl" />
      <div className="emprovex-logo-core__bracket emprovex-logo-core__bracket--br" />

      <div className="emprovex-logo-core__surface">
        <div className="emprovex-logo-core__edge" />
        <div className="emprovex-logo-core__specular" />

        <div className="emprovex-logo-core__mark">
          {customLogo ? (
            <Image
              src={customLogo}
              alt="Logotipo EMPROVEX"
              width={128}
              height={128}
              unoptimized
              priority
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="font-montserrat text-2xl font-black tracking-[0.14em] text-white sm:text-3xl">
              EMP
            </span>
          )}
        </div>

        <div className="emprovex-logo-core__reflection" />
        <div className="emprovex-logo-core__pulse" />
      </div>

      <div className="emprovex-logo-core__status" aria-hidden="true">
        <span />
      </div>
    </motion.div>
  );
}
