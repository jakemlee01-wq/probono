import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type T = { id: number; text: string; bad: boolean };
const Ctx = createContext<(text: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, bad = false) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, text, bad }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), bad ? 7000 : 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      {/* Errors are announced assertively; confirmations politely. */}
      <div className="pointer-events-none fixed left-0 right-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        <div aria-live="assertive" className="contents">
          {items.filter((t) => t.bad).map((t) => (
            <div key={t.id} role="alert" className="sheet-in pointer-events-auto max-w-sm rounded-2xl bg-[#8a2f25] px-4 py-3 text-sm text-cream shadow-lg">{t.text}</div>
          ))}
        </div>
        <div aria-live="polite" className="contents">
          {items.filter((t) => !t.bad).map((t) => (
            <div key={t.id} role="status" className="sheet-in pointer-events-auto max-w-sm rounded-2xl bg-plum px-4 py-3 text-sm text-cream shadow-lg ring-1 ring-cream/20">{t.text}</div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}
