import { useEffect } from 'react';
import { useAppStore, type Toast } from '../store/appStore';

export const TOAST_MS = 2500;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useAppStore((s) => s.dismissToast);
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(id);
  }, [dismiss, toast.id]);
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      {toast.text}
    </div>
  );
}

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
