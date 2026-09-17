'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface ToastNotificationProps {
  toast: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
  onClose: () => void;
}

const TOAST_DURATION_SECONDS = 4;

export function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const tone = toast?.type === 'success'
    ? {
        label: 'Concluído',
        container: 'bg-emerald-50/95 text-emerald-900 border-emerald-200/90',
        icon: 'text-emerald-600',
        progress: 'bg-emerald-500',
      }
    : toast?.type === 'error'
      ? {
          label: 'Atenção',
          container: 'bg-rose-50/95 text-rose-900 border-rose-200/90',
          icon: 'text-rose-600',
          progress: 'bg-rose-500',
        }
      : {
          label: 'Informação',
          container: 'bg-blue-50/95 text-blue-900 border-blue-200/90',
          icon: 'text-blue-600',
          progress: 'bg-blue-500',
        };

  return (
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          key={`${toast.type}:${toast.message}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          initial={{ opacity: 0, y: -18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={`fixed top-16 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-[390px] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ${tone.container}`}
        >
          <div className="flex items-start gap-3 p-4 pr-3">
            <div className={`mt-0.5 shrink-0 ${tone.icon}`} aria-hidden="true">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'info' && <Info className="w-5 h-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] opacity-65 mb-0.5">
                {tone.label}
              </p>
              <p className="text-sm font-semibold leading-5 break-words">{toast.message}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar notificação"
              className="shrink-0 p-1.5 -mt-1 rounded-lg text-current/45 hover:text-current hover:bg-black/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="h-0.5 bg-black/5" aria-hidden="true">
            <motion.div
              className={`h-full origin-left ${tone.progress}`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: TOAST_DURATION_SECONDS, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
