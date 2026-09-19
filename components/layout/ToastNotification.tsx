'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface ToastNotificationProps {
  toast: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
  onClose: () => void;
}

const TOAST_DURATION_SECONDS = 4;

const TONES = {
  success: {
    label: 'Operação concluída',
    eyebrow: 'EMPROVEX // CONFIRMAÇÃO',
    icon: CheckCircle2,
    accent: 'text-emerald-300',
    iconSurface: 'border-emerald-300/20 bg-emerald-400/[0.09]',
    statusDot: 'bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]',
    progress: 'from-emerald-300/20 via-emerald-300 to-cyan-200/70',
    aura: 'bg-emerald-400/[0.08]',
  },
  error: {
    label: 'Atenção necessária',
    eyebrow: 'EMPROVEX // ALERTA',
    icon: AlertTriangle,
    accent: 'text-rose-300',
    iconSurface: 'border-rose-300/20 bg-rose-400/[0.09]',
    statusDot: 'bg-rose-300 shadow-[0_0_12px_rgba(253,164,175,0.72)]',
    progress: 'from-rose-300/20 via-rose-300 to-amber-200/70',
    aura: 'bg-rose-400/[0.08]',
  },
  info: {
    label: 'Informação do sistema',
    eyebrow: 'EMPROVEX // SISTEMA',
    icon: Info,
    accent: 'text-blue-200',
    iconSurface: 'border-blue-300/20 bg-blue-400/[0.09]',
    statusDot: 'bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.72)]',
    progress: 'from-blue-300/20 via-blue-300 to-cyan-200/80',
    aura: 'bg-blue-400/[0.09]',
  },
} as const;

export function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const shouldReduceMotion = useReducedMotion();
  const tone = toast ? TONES[toast.type] : TONES.info;
  const Icon = tone.icon;

  return (
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          key={`${toast.type}:${toast.message}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          data-toast-type={toast.type}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.975 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.985 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.12 }
              : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
          }
          className="fixed left-3 right-3 top-3 z-[100] overflow-hidden rounded-[1.35rem] border border-white/[0.10] bg-[#061126]/[0.96] text-slate-100 shadow-[0_24px_80px_rgba(0,8,28,0.42),0_0_0_1px_rgba(96,165,250,0.035)] backdrop-blur-2xl sm:left-auto sm:right-6 sm:top-20 sm:w-[410px]"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className={`absolute -right-14 -top-16 h-40 w-40 rounded-full blur-3xl ${tone.aura}`} />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/45 to-transparent" />
            <div className="absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-blue-300/25 to-transparent" />
            <div className="absolute right-4 top-3 font-mono text-[7px] font-bold uppercase tracking-[0.22em] text-slate-500/50">
              SYS/NOTIFY
            </div>
          </div>

          <div className="relative flex items-start gap-3.5 px-4 pb-4 pt-4 sm:px-[1.1rem] sm:pb-[1.05rem] sm:pt-[1.05rem]">
            <div
              className={`relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${tone.iconSurface} ${tone.accent}`}
              aria-hidden="true"
            >
              <span className="absolute inset-[5px] rounded-lg border border-white/[0.035]" />
              <Icon className="relative h-[1.15rem] w-[1.15rem]" strokeWidth={2.1} />
            </div>

            <div className="min-w-0 flex-1 pr-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.statusDot}`} aria-hidden="true" />
                <p className="truncate font-mono text-[8px] font-bold uppercase tracking-[0.19em] text-slate-500">
                  {tone.eyebrow}
                </p>
              </div>

              <p className={`mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${tone.accent}`}>
                {tone.label}
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-100 sm:text-sm">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar notificação"
              className="relative -mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-slate-500 transition-[color,border-color,background-color,transform] duration-200 hover:border-blue-300/15 hover:bg-blue-400/[0.08] hover:text-slate-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#061126]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative h-[3px] overflow-hidden bg-white/[0.025]" aria-hidden="true">
            <motion.div
              className={`h-full origin-left bg-gradient-to-r ${tone.progress}`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: shouldReduceMotion ? 1 : 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: TOAST_DURATION_SECONDS, ease: 'linear' }
              }
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
