import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { ICircleProvider } from "../lib/interfaces/utils/ICircleProvider";

const CircleContext = createContext<ICircleProvider | null>(null);

export function CircleContextProvider({
  provider,
  children,
}: {
  provider: ICircleProvider;
  children: ReactNode;
}) {
  const value = useMemo(() => provider, [provider]);
  return (
    <CircleContext.Provider value={value}>{children}</CircleContext.Provider>
  );
}

export function useCircle(): ICircleProvider {
  const ctx = useContext(CircleContext);
  if (!ctx) {
    throw new Error("useCircle must be used within CircleContextProvider");
  }
  return ctx;
}
