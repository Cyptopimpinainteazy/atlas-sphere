import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { TOAST_AUTO_DISMISS_MS } from '../constants';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProviderContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = React.createContext<ToastProviderContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type };
    
    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after timeout
    const timer = setTimeout(() => {
      removeToast(id);
    }, TOAST_AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-900/20 border-green-700 text-green-300';
      case 'error':
        return 'bg-red-900/20 border-red-700 text-red-300';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-700 text-yellow-300';
      case 'info':
      default:
        return 'bg-blue-900/20 border-blue-700 text-blue-300';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border ${getStyles(
            toast.type
          )} animate-in slide-in-from-right-4 fade-in`}
          role="alert"
        >
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            aria-label={`Dismiss ${toast.type} notification`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
