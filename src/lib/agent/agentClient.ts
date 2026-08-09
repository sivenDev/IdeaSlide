import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AgentRunEvent,
  AgentRunRequest,
  AgentRunResponse,
  AgentRuntimeDescriptor,
  AgentSkillMetadata,
} from "./types";
import type { AgentThreadPage, AgentThreadRecord } from "./protocol";

function requireTauri(): void {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("Agent model calls are available in the IdeaNote desktop app.");
  }
}

export async function discoverAgentSkills(): Promise<AgentSkillMetadata[]> {
  requireTauri();
  return invoke<AgentSkillMetadata[]>("discover_agent_skills");
}

export async function listAgentRuntimes(): Promise<AgentRuntimeDescriptor[]> {
  requireTauri();
  return invoke<AgentRuntimeDescriptor[]>("list_agent_runtimes");
}

export async function runAgent(
  request: AgentRunRequest,
  onEvent: (event: AgentRunEvent) => void,
): Promise<AgentRunResponse> {
  requireTauri();
  const channel = new Channel<AgentRunEvent>();
  channel.onmessage = onEvent;
  return invoke<AgentRunResponse>("run_agent", { request, onEvent: channel });
}

export async function cancelAgent(runId: string): Promise<boolean> {
  requireTauri();
  return invoke<boolean>("cancel_agent", { runId });
}

export async function submitAgentToolResult(runId: string, result: unknown): Promise<boolean> {
  requireTauri();
  return invoke<boolean>("submit_agent_tool_result", { runId, result });
}

export async function saveAgentThread(record: AgentThreadRecord): Promise<AgentThreadRecord> {
  requireTauri();
  return invoke<AgentThreadRecord>("save_agent_thread", { record });
}

export async function getAgentThread(threadId: string): Promise<AgentThreadRecord | undefined> {
  requireTauri();
  return (await invoke<AgentThreadRecord | null>("get_agent_thread", { threadId })) ?? undefined;
}

export async function listAgentThreads({
  cursor,
  limit = 20,
  includeArchived = false,
}: {
  cursor?: string;
  limit?: number;
  includeArchived?: boolean;
} = {}): Promise<AgentThreadPage> {
  requireTauri();
  return invoke<AgentThreadPage>("list_agent_threads", { cursor, limit, includeArchived });
}

export async function renameAgentThread(threadId: string, title: string): Promise<AgentThreadRecord> {
  requireTauri();
  return invoke<AgentThreadRecord>("rename_agent_thread", { threadId, title });
}

export async function archiveAgentThread(threadId: string): Promise<AgentThreadRecord> {
  requireTauri();
  return invoke<AgentThreadRecord>("archive_agent_thread", { threadId });
}

export async function deleteAgentThread(threadId: string): Promise<boolean> {
  requireTauri();
  return invoke<boolean>("delete_agent_thread", { threadId });
}
