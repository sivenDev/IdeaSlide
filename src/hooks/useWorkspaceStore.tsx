import { createContext, useContext, useReducer, type ReactNode } from "react";
import {
  createInitialWorkspaceStoreState,
  workspaceStoreReducer,
  type WorkspaceStoreAction,
  type WorkspaceStoreState,
} from "../lib/workspaceStoreReducer.ts";

const WorkspaceStoreContext = createContext<{
  state: WorkspaceStoreState;
  dispatch: React.Dispatch<WorkspaceStoreAction>;
} | null>(null);

export function WorkspaceStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    workspaceStoreReducer,
    undefined,
    createInitialWorkspaceStoreState,
  );
  return (
    <WorkspaceStoreContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkspaceStoreContext.Provider>
  );
}

export function useWorkspaceStore() {
  const context = useContext(WorkspaceStoreContext);
  if (!context) {
    throw new Error("useWorkspaceStore must be used within WorkspaceStoreProvider");
  }
  return context;
}
