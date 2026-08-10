import type { AgentPolicySettings } from "./types";
import type { AgentThreadState } from "./protocol";

export type AgentDiagnosticViewState =
  | "healthy"
  | "degraded"
  | "approaching-limit"
  | "high-pressure"
  | "compacted"
  | "unavailable"
  | "unknown";

export interface AgentDiagnosticView {
  state: AgentDiagnosticViewState;
  label: string;
  detail: string;
  usedPercent?: number;
  recommendNewThread: boolean;
}

export function selectAgentDiagnosticView(
  state: AgentThreadState,
  policy: AgentPolicySettings,
): AgentDiagnosticView {
  const usedPercent = state.context.status === "available"
    && state.context.modelContextWindow
    && state.context.modelContextWindow > 0
    && typeof state.context.usedPercent === "number"
      ? Math.min(100, Math.max(0, Math.round(state.context.usedPercent)))
      : undefined;

  if (usedPercent !== undefined && usedPercent >= policy.newThreadPercent) {
    return {
      state: "high-pressure",
      label: "High context pressure",
      detail: `${usedPercent}% of the exact runtime context window is in use. Start a new Thread before a separate task.`,
      usedPercent,
      recommendNewThread: true,
    };
  }
  if (usedPercent !== undefined && usedPercent >= policy.contextWarningPercent) {
    return {
      state: "approaching-limit",
      label: "Approaching context limit",
      detail: `${usedPercent}% of the exact runtime context window is in use.`,
      usedPercent,
      recommendNewThread: false,
    };
  }
  if (state.context.runtimeCompactedAt) {
    return {
      state: "compacted",
      label: "Runtime context compacted",
      detail: "The runtime compacted upstream working context. Visible Thread history is unchanged.",
      usedPercent,
      recommendNewThread: false,
    };
  }
  if (state.runtime.health === "unavailable") {
    return {
      state: "unavailable",
      label: "Runtime unavailable",
      detail: state.runtime.diagnostic ?? "The selected runtime is unavailable.",
      recommendNewThread: false,
    };
  }
  if (state.runtime.health === "degraded" || state.runtime.degraded) {
    return {
      state: "degraded",
      label: "Compatibility runtime",
      detail: state.runtime.diagnostic ?? "The Thread is using a reduced-capability runtime.",
      usedPercent,
      recommendNewThread: false,
    };
  }
  if (usedPercent !== undefined || state.context.status === "available") {
    return {
      state: "healthy",
      label: "Runtime healthy",
      detail: usedPercent === undefined
        ? "Exact token usage is available, but the runtime did not supply a context window."
        : `${usedPercent}% of the exact runtime context window is in use.`,
      usedPercent,
      recommendNewThread: false,
    };
  }
  if (state.context.status === "unavailable") {
    return {
      state: "unavailable",
      label: "Context usage unavailable",
      detail: state.context.message ?? "The runtime did not supply exact token usage.",
      recommendNewThread: false,
    };
  }
  return {
    state: "unknown",
    label: "Context status unknown",
    detail: state.context.message ?? "The runtime has not reported context state yet.",
    recommendNewThread: false,
  };
}
