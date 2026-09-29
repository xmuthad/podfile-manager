import { memo } from 'react';
import type { Toast, ToastType } from '../hooks/useToast';
import { IconCheck, IconX, IconAlert, IconInfo } from './icons';

const ICONS: Record<ToastType, typeof IconCheck> = {
  success: IconCheck,
  error: IconX,
  warning: IconAlert,
  info: IconInfo,
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

export const ToastContainer = memo(function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => onRemove(t.id)}>
            <span className="toast-icon"><Icon size={14} /></span>
            <span className="toast-message">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
});