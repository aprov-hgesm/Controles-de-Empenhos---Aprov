'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

interface LoginSuccessTransitionProps {
  customLogo: string | null;
  onComplete: () => void;
}

export function LoginSuccessTransition({
  customLogo,
  onComplete,
}: LoginSuccessTransitionProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <motion.div
        aria-hidden="true"
        className="emprovex-login-success fixed inset-0 z-[80] pointer-events-none"
        initial={{ opacity: 0.22 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onAnimationComplete={onComplete}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      className="emprovex-login-success fixed inset-0 z-[80] pointer-events-none overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onComplete}
    >
      <div className="emprovex-login-success__backdrop absolute inset-0" />
      <div className="emprovex-login-success__wave absolute left-1/2 top-1/2" />
      <div className="emprovex-login-success__beam absolute left-1/2 top-1/2" />

      <motion.div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        initial={{ scale: 0.94, opacity: 0.84 }}
        animate={{ scale: 1.08, opacity: 0 }}
        transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="emprovex-login-success__core relative grid h-24 w-24 place-items-center overflow-hidden rounded-[1.8rem] border border-emerald-200/20 bg-[#071225]/82 p-3 backdrop-blur-2xl sm:h-28 sm:w-28">
          <div className="emprovex-login-success__core-glow absolute inset-0" />
          <div className="relative z-[2] grid h-full w-full place-items-center">
            {customLogo ? (
              <Image
                src={customLogo}
                alt=""
                width={112}
                height={112}
                unoptimized
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="font-montserrat text-2xl font-black tracking-[0.14em] text-white sm:text-3xl">
                EMP
              </span>
            )}
          </div>

          <motion.div
            className="absolute bottom-2.5 right-2.5 z-[3] grid h-5 w-5 place-items-center rounded-full border border-emerald-200/30 bg-emerald-400/15 text-emerald-200"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
          >
            <Check className="h-3 w-3" strokeWidth={2.5} />
          </motion.div>
        </div>

        <motion.p
          className="mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-emerald-100/70"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: [0, 1, 0], y: [5, 0, -3] }}
          transition={{ duration: 0.42, times: [0, 0.28, 1] }}
        >
          Acesso autorizado
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
