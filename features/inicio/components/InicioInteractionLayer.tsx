'use client';

import { type RefObject, useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

import styles from './InicioInteractionLayer.module.css';

interface InicioInteractionLayerProps {
  sceneRef: RefObject<HTMLElement | null>;
}

export function InicioInteractionLayer({
  sceneRef,
}: InicioInteractionLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const scene = sceneRef.current;
    const layer = layerRef.current;
    if (!scene || !layer || reduceMotion) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    if (!finePointer.matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      layer.style.setProperty('--pointer-x', `${currentX.toFixed(2)}px`);
      layer.style.setProperty('--pointer-y', `${currentY.toFixed(2)}px`);
      frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = scene.getBoundingClientRect();
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
      layer.dataset.visible = 'true';

      const interactive = (event.target as Element | null)?.closest(
        'button, a, [role="button"], [tabindex]'
      );
      layer.dataset.target = interactive ? 'true' : 'false';
    };

    const handlePointerLeave = () => {
      layer.dataset.visible = 'false';
      layer.dataset.target = 'false';
    };

    const handlePointerDown = (event: PointerEvent) => {
      const rect = scene.getBoundingClientRect();
      layer.style.setProperty('--pulse-x', `${(event.clientX - rect.left).toFixed(2)}px`);
      layer.style.setProperty('--pulse-y', `${(event.clientY - rect.top).toFixed(2)}px`);
      layer.dataset.pulse = 'false';
      void layer.offsetWidth;
      layer.dataset.pulse = 'true';
    };

    const handleAnimationEnd = (event: AnimationEvent) => {
      if ((event.target as HTMLElement).dataset.role === 'interaction-pulse') {
        layer.dataset.pulse = 'false';
      }
    };

    scene.addEventListener('pointermove', handlePointerMove, { passive: true });
    scene.addEventListener('pointerleave', handlePointerLeave);
    scene.addEventListener('pointerdown', handlePointerDown);
    layer.addEventListener('animationend', handleAnimationEnd);
    frame = window.requestAnimationFrame(render);

    return () => {
      scene.removeEventListener('pointermove', handlePointerMove);
      scene.removeEventListener('pointerleave', handlePointerLeave);
      scene.removeEventListener('pointerdown', handlePointerDown);
      layer.removeEventListener('animationend', handleAnimationEnd);
      window.cancelAnimationFrame(frame);
    };
  }, [reduceMotion, sceneRef]);

  return (
    <div
      ref={layerRef}
      className={styles.root}
      data-visible="false"
      data-target="false"
      data-pulse="false"
      aria-hidden="true"
    >
      <span className={styles.reticle}>
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className={styles.pointerDot} />
      <span className={styles.telemetry}>
        <b>SYS</b>
        <span>INTERFACE</span>
      </span>
      <span className={styles.pulse} data-role="interaction-pulse" />
    </div>
  );
}
