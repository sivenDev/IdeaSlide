import type { DocumentModel, DocumentSession } from "../../types";
import type { AgentErrorCode } from "./protocol";

export interface AgentToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentSkillMetadata {
  id: string;
  name: string;
  description: string;
}

export type AgentRuntimeKind = "compatibility" | "codexAppServer" | "grokAcp";

export interface AgentRuntimeDescriptor {
  kind: AgentRuntimeKind;
  label: string;
  installed: boolean;
  compatible: boolean;
  experimental: boolean;
  capabilities: {
    textStreaming: boolean;
    reasoningSummary: boolean;
    plans: boolean;
    toolEvents: boolean;
    approvals: boolean;
    cancellation: boolean;
    steering: boolean;
    retry: boolean;
    persistence: boolean;
    editorTools: boolean;
  };
  diagnostic?: string;
}

export interface AgentRunRequest {
  runId: string;
  prompt: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  skillId?: string;
  context: Record<string, unknown>;
  tools: AgentToolDescriptor[];
  messages: Array<Pick<AgentMessage, "role" | "content">>;
}

export interface AgentRunResponse {
  runId: string;
  text: string;
  skillId?: string;
  capabilities: AgentProviderCapabilities;
  telemetry: AgentStreamingTelemetry;
}

export type AgentProviderStrategy = "responses" | "chatCompletions";

export interface AgentProviderCapabilities {
  strategy: AgentProviderStrategy;
  textStreaming: boolean;
  reasoningSummary: boolean;
  toolEvents: boolean;
  cancellation: boolean;
  retry: boolean;
  timing: boolean;
}

export type AgentStreamingBehavior = "incremental" | "buffered" | "indeterminate";

export interface AgentStreamingTelemetry {
  strategy: AgentProviderStrategy;
  attempts: number;
  requestMs: number;
  firstEventMs?: number;
  firstTextMs?: number;
  eventSpanMs: number;
  totalMs: number;
  eventCount: number;
  behavior: AgentStreamingBehavior;
}

export interface AgentNativeError {
  code: AgentErrorCode;
  message: string;
  recovery?: string;
  diagnosticId: string;
  retryable: boolean;
}

export type AgentRunEvent =
  | { type: "started"; runId: string }
  | { type: "capabilities"; runId: string; capabilities: AgentProviderCapabilities }
  | {
    type: "strategyFallback";
    runId: string;
    from: AgentProviderStrategy;
    to: AgentProviderStrategy;
    reason: string;
  }
  | {
    type: "retryScheduled";
    runId: string;
    attempt: number;
    delayMs: number;
    diagnostic: AgentNativeError;
  }
  | { type: "reasoningSummaryDelta"; runId: string; text: string }
  | { type: "textDelta"; runId: string; text: string }
  | { type: "toolStarted"; runId: string; callId: string; name: string }
  | { type: "toolCompleted"; runId: string; callId: string; name: string }
  | { type: "telemetry"; runId: string; telemetry: AgentStreamingTelemetry }
  | { type: "completed"; runId: string; text: string; skillId?: string }
  | { type: "cancelled"; runId: string }
  | { type: "error"; runId: string; error: AgentNativeError };

export interface AgentChangeSet<TOperation = unknown> {
  id: string;
  extensionId: string;
  documentId: string;
  baseRevision: number;
  baseDocumentStatus?: DocumentSession["status"];
  baseSourceModified?: string;
  sourceFingerprint: string;
  summary: string;
  operations: TOperation[];
  status: "proposed" | "applied" | "rejected" | "stale";
}

export interface AgentExtension<TModel extends DocumentModel = DocumentModel, TOperation = unknown> {
  id: string;
  fileType: string;
  skillId: string;
  tools: AgentToolDescriptor[];
  buildContext(model: TModel, activePageId: string | undefined, revision: number): Record<string, unknown>;
  parseChangeSet(response: string, documentId: string, revision: number, model: TModel): AgentChangeSet<TOperation> | undefined;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ActiveAgentEditorBinding {
  document: DocumentSession;
  extensionId: string;
  fileType: string;
  skillId: string;
  tools: AgentToolDescriptor[];
  activeContextId?: string;
  readOnly: boolean;
  buildContext: () => Record<string, unknown>;
  parseChangeSet: (response: string) => AgentChangeSet | undefined;
  applyChangeSet: (changeSet: AgentChangeSet) => boolean;
  undo: () => void;
  canUndo: boolean;
}
