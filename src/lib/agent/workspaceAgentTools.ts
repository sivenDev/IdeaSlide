import { syncWorkspaceAgentContextCommand } from "../tauriCommands.ts";

export interface WorkspaceAgentContext {
  root?: string;
  readOnly: boolean;
  protectedPaths: string[];
  generation: number;
}

export interface WorkspaceAgentContextStatus {
  available: boolean;
  capabilityId?: string;
  generation: number;
}

export async function syncWorkspaceAgentContext(
  context: WorkspaceAgentContext,
): Promise<WorkspaceAgentContextStatus | undefined> {
  if (!("__TAURI_INTERNALS__" in window)) return undefined;
  return syncWorkspaceAgentContextCommand(context);
}
