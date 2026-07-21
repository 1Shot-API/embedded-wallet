import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { IResolvedStyle } from "./types";
import { styleController } from "./styleController";

export interface IStyleContextValue {
  style: IResolvedStyle;
}

const StyleContext = createContext<IStyleContextValue | null>(null);

export function StyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyle] = useState(() => styleController.get());

  useEffect(() => styleController.subscribe(setStyle), []);

  const value = useMemo(() => ({ style }), [style]);

  return (
    <StyleContext.Provider value={value}>{children}</StyleContext.Provider>
  );
}

export function useStyle(): IStyleContextValue {
  const ctx = useContext(StyleContext);
  if (!ctx) {
    throw new Error("useStyle must be used within StyleProvider");
  }
  return ctx;
}
