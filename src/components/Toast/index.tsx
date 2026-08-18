import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmItem {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
}

interface ToastContextType {
  show: (message: string, type?: ToastType) => void;
  confirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Global singleton ref for imperative calls (no hook needed)
let globalShow: ((message: string, type?: ToastType) => void) | null = null;
let globalConfirm: ((message: string) => Promise<boolean>) | null = null;

export function showToast(message: string, type: ToastType = 'info') {
  if (globalShow) {
    globalShow(message, type);
  } else {
    alert(message);
  }
}

export function showConfirm(message: string): Promise<boolean> {
  if (globalConfirm) {
    return globalConfirm(message);
  }
  // Fallback
  return Promise.resolve(window.confirm(message));
}

let nextId = 0;

const iconMap: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: 'border-green-400 bg-green-50 text-green-800',
  error: 'border-red-400 bg-red-50 text-red-800',
  warning: 'border-yellow-400 bg-yellow-50 text-yellow-800',
  info: 'border-blue-400 bg-blue-50 text-blue-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirms, setConfirms] = useState<ConfirmItem[]>([]);
  const timers = useRef<Set<number>>(new Set());

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
    timers.current.add(timer);
  }, []);

  // 自定义确认弹窗（替代 window.confirm，解决内嵌浏览器拦截问题）
  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = nextId++;
      setConfirms((prev) => [...prev, { id, message, resolve }]);
    });
  }, []);

  const dismissConfirm = useCallback((id: number, ok: boolean) => {
    setConfirms((prev) => {
      const item = prev.find((c) => c.id === id);
      if (item) {
        // 异步 resolve，避免 setState 中的 setState 警告
        setTimeout(() => item.resolve(ok), 0);
      }
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  // Register global singleton on mount, clean up timers on unmount
  useEffect(() => {
    globalShow = show;
    globalConfirm = confirm;
    return () => {
      globalShow = null;
      globalConfirm = null;
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [show, confirm]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, confirm }}>
      {children}
      {/* Toast 容器 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md">
        {toasts.map((t) => {
          const Icon = iconMap[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${colorMap[t.type]}`}
              style={{
                animation: 'slideIn 0.3s ease-out',
              }}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm flex-1 break-words whitespace-pre-line">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="flex-shrink-0 hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
      {/* Confirm 弹窗（替代 window.confirm，支持内嵌浏览器） */}
      {confirms.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              dismissConfirm(confirms[0].id, false);
            } else if (e.key === 'Enter') {
              dismissConfirm(confirms[0].id, true);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl mx-4 max-w-md w-full overflow-hidden"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          >
            {/* 标题栏 */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span className="font-semibold text-gray-800 text-base">确认操作</span>
            </div>
            {/* 消息内容 */}
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {confirms[0].message}
              </p>
            </div>
            {/* 按钮 */}
            <div className="flex justify-end gap-3 px-5 py-3 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => dismissConfirm(confirms[0].id, false)}
                className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => dismissConfirm(confirms[0].id, true)}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // fallback to alert if no provider
    return {
      show: (msg) => alert(msg),
      confirm: (msg) => Promise.resolve(window.confirm(msg)),
    };
  }
  return ctx;
}
