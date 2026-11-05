import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";

const ActiveFamilyContext = createContext<{ selected: string; setSelected: Dispatch<SetStateAction<string>> } | null>(null);

export function ActiveFamilyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const storageKey = `maban:active-family:${userId}`;
  const [selected, setSelected] = useState(() => {
    try { return sessionStorage.getItem(storageKey) ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, selected); } catch { /* Selection still works in memory. */ }
  }, [storageKey, selected]);
  return <ActiveFamilyContext.Provider value={{ selected, setSelected }}>{children}</ActiveFamilyContext.Provider>;
}

export function useActiveFamily() {
  const value = useContext(ActiveFamilyContext);
  if (!value) throw new Error("ActiveFamilyProvider is required");
  return value;
}
