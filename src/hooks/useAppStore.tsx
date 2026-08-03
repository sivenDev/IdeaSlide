import { createContext, useContext, useReducer, type ReactNode } from "react";
import {
  appStoreReducer,
  createInitialAppState,
  type AppStoreAction,
} from "../lib/appStoreReducer.ts";
import type { ApplicationState } from "../types.ts";

const AppStoreContext = createContext<{
  state: ApplicationState;
  dispatch: React.Dispatch<AppStoreAction>;
} | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appStoreReducer, undefined, createInitialAppState);
  return <AppStoreContext.Provider value={{ state, dispatch }}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) throw new Error("useAppStore must be used within AppStoreProvider");
  return context;
}
