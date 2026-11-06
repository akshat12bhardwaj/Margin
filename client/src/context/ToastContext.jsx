import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const show = useCallback((message, tone) => {
    const id = ++nextId.current;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ success: (m) => show(m, 'good'), error: (m) => show(m, 'bad') }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
