'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { cn } from './Button';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
  onClick?: () => void;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, actionLabel?: string, onAction?: () => void, onClick?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', actionLabel?: string, onAction?: () => void, onClick?: () => void) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => {
      const next = [...prev, { id, message, type, actionLabel, onAction, onClick }];
      if (next.length > 3) {
        return next.slice(next.length - 3);
      }
      return next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              if (t.onClick) {
                t.onClick();
                removeToast(t.id);
              }
            }}
            className={cn(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[12px] shadow-lg min-w-[300px] transform transition-all duration-300 translate-x-0',
              t.onClick ? 'cursor-pointer hover:opacity-90' : '',
              {
                'bg-theme-online-bg text-theme-online border border-theme-accent-green/20': t.type === 'success',
                'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900': t.type === 'error',
                'bg-theme-row-active text-theme-primary border border-theme-primary/20': t.type === 'info',
              }
            )}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 flex-shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
            
            <span className="text-sm font-medium flex-1 text-theme-text">{t.message}</span>
            
            {t.actionLabel && t.onAction && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  t.onAction!();
                  removeToast(t.id);
                }} 
                className="text-xs font-semibold text-theme-primary hover:opacity-80 transition-opacity uppercase mr-2"
              >
                {t.actionLabel}
              </button>
            )}

            <button onClick={(e) => { e.stopPropagation(); removeToast(t.id); }} className="text-theme-text-secondary hover:text-theme-text transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
};
