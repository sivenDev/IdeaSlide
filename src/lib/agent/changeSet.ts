import type { AgentChangeSet } from "./types.ts";

export function rejectAgentChangeSet<T>(changeSet: AgentChangeSet<T>): AgentChangeSet<T> {
  if (changeSet.status !== "proposed") return changeSet;
  return { ...changeSet, status: "rejected" };
}

export function markAgentChangeSetStale<T>(changeSet: AgentChangeSet<T>): AgentChangeSet<T> {
  if (changeSet.status !== "proposed") return changeSet;
  return { ...changeSet, status: "stale" };
}

export function markAgentChangeSetApplied<T>(changeSet: AgentChangeSet<T>): AgentChangeSet<T> {
  if (changeSet.status !== "proposed") throw new Error("Only a proposed Agent change can be applied");
  return { ...changeSet, status: "applied" };
}
