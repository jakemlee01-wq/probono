import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type T = { id: number; text: string; bad: boolean };
const Ctx = createContext<(text: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, bad = false) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, bad }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed left-0 right-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`sheet-in pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm shadow-lg ${t.bad ? 'bg-[#8a2f25] text-cream' : 'bg-plum text-cream ring-1 ring-cream/20'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
