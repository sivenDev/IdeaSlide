import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AgentRunEvent,
  AgentRunRequest,
  AgentRunResponse,
  AgentRuntimeDescriptor,
  AgentSkillMetadata,
} from "./types";

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
