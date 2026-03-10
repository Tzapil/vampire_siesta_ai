import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AppHeaderContextValue = {
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
};

const AppHeaderContext = createContext<AppHeaderContextValue | undefined>(undefined);

export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode | null>(null);
  const value = useMemo(() => ({ actions, setActions }), [actions]);
  return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
}

export function useAppHeader() {
  const ctx = useContext(AppHeaderContext);
  if (!ctx) {
    throw new Error("useAppHeader must be used within AppHeaderProvider");
  }
  return ctx;
}
