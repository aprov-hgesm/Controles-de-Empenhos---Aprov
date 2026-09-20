'use client';

import type React from 'react';
import type { User } from 'firebase/auth';

import type { Alert, AlertStatus } from '../../../lib/types';
import { saveAlert } from '../../../lib/firebaseSync';

type ToastType = 'success' | 'error' | 'info';

interface UseAvisosActionsInput {
  user: User | null;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  showToast: (message: string, type?: ToastType) => void;
}

function applyLifecycleMetadata(alert: Alert, status: AlertStatus): Alert {
  const now = new Date().toISOString();

  return {
    ...alert,
    status,
    readAt: status === 'LIDO' || status === 'RESOLVIDO' || status === 'ARQUIVADO'
      ? alert.readAt ?? now
      : undefined,
    resolvedAt: status === 'RESOLVIDO' ? now : undefined,
    archivedAt: status === 'ARQUIVADO' ? now : undefined,
  };
}

export function useAvisosActions({
  user,
  alerts,
  setAlerts,
  showToast,
}: UseAvisosActionsInput) {
  const updateNoticeStatus = async (alert: Alert, status: AlertStatus) => {
    if (!user) {
      showToast('Sua sessão expirou. Entre novamente para atualizar o aviso.', 'error');
      return false;
    }

    const updated = applyLifecycleMetadata(alert, status);

    try {
      await saveAlert(user.uid, updated);
      setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item));
      return true;
    } catch (error) {
      console.error('Erro ao atualizar aviso:', error);
      showToast(
        error instanceof Error ? error.message : 'Não foi possível atualizar o aviso.',
        'error'
      );
      return false;
    }
  };

  const markAllUnreadAsRead = async () => {
    if (!user) {
      showToast('Sua sessão expirou. Entre novamente para atualizar os avisos.', 'error');
      return;
    }

    const unread = alerts.filter((alert) => (alert.status ?? 'NOVO') === 'NOVO');
    if (unread.length === 0) {
      showToast('Não há avisos novos para marcar como lidos.', 'info');
      return;
    }

    try {
      const updated = unread.map((alert) => applyLifecycleMetadata(alert, 'LIDO'));
      await Promise.all(updated.map((alert) => saveAlert(user.uid, alert)));
      const updatedById = new Map(updated.map((alert) => [alert.id, alert]));
      setAlerts((current) => current.map((alert) => updatedById.get(alert.id) ?? alert));
      showToast(`${updated.length} aviso(s) marcado(s) como lido(s).`, 'success');
    } catch (error) {
      console.error('Erro ao marcar avisos como lidos:', error);
      showToast('Não foi possível atualizar todos os avisos.', 'error');
    }
  };

  return {
    updateNoticeStatus,
    markAllUnreadAsRead,
  };
}
