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

export function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className={`fixed top-16 right-4 left-4 sm:left-auto sm:right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80' :
            toast.type === 'error' ? 'bg-rose-50/90 text-rose-800 border-rose-200/80' :
            'bg-blue-50/90 text-blue-800 border-blue-200/80'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
          <span className="font-medium text-sm">{toast.message}</span>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
