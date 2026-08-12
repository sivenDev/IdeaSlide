import type { DocumentSession } from "../../types";
import type { AgentErrorCode } from "./protocol";
import type { AgentEvent, AgentTurnBindingSnapshot } from "./protocol";

export interface AgentToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requires?: string[];
  source?: "editor" | "workspace" | "skill";
  effect?: "read" | "write" | "destructive";
}

export interface AgentToolCall {
  callId: string;
  name: string;
  arguments: unknown;
}

export interface AgentToolReadResult {
  kind: "read";
  callId: string;
  name: string;
  success: true;
  summary: string;
  content: unknown;
  truncated: boolean;
  persistable: boolean;
}

export interface AgentToolMutationResult<TOperation = unknown> {
  kind: "mutation";
  callId: string;
  name: string;
  success: true;
  summary: string;
  changeSet: AgentChangeSet<TOperation>;
  truncated: false;
  persistable: boolean;
}

export interface AgentToolFailureResult {
  kind: "failure";
  callId: string;
  name: string;
  success: false;
  summary: string;
  error: AgentNativeError;
  truncated: false;
  persistable: true;
}

export type AgentToolResult<TOperation = unknown> =
  | AgentToolReadResult
  | AgentToolMutationResult<TOperation>
  | AgentToolFailureResult;

export interface AgentToolExecutionContext<TModel = unknown> {
  documentId: string;
  revision: number;
  documentStatus: DocumentSession["status"];
  sourceModified?: string;
  activeContextId?: string;
  model: TModel;
}

export interface AgentToolExecutor {
  execute(call: AgentToolCall, signal?: AbortSignal): Promise<AgentToolResult>;
  cancel(callId: string): void;
}

export interface AgentSkillMetadata {
  id: string;
  name: string;
  description: string;
  origin: "bundled" | "custom";
  sourceLabel: string;
  enabled: boolean;
  implicitInvocation: boolean;
  editorScopes: string[];
  digest: string;
  valid: boolean;
  validationMessage?: string;
  lastRefreshedAt?: number;
  resources: Array<{ id: string; label: string }>;
  requiredTools: string[];
}

export type AgentSkillActivationMode = "mandatory" | "explicit" | "implicit";

export interface AgentSkillProvenance {
  id: string;
  name: string;
  origin: AgentSkillMetadata["origin"];
  digest: string;
  activationMode: AgentSkillActivationMode;
  editorScope: string;
}

export type AgentRuntimeKind = "compatibility" | "codexAppServer" | "grokAcp";
export type AgentReasoningEffort = "standard";

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
  threadId: string;
  retryOfTurnId?: string;
  upstreamThreadId?: string;
  upstreamToolSignature?: string;
  prompt: string;
  binding: AgentTurnBindingSnapshot;
  baseUrl: string;
  model: string;
  availableModels: string[];
  reasoningEffort: AgentReasoningEffort;
  systemPrompt: string;
  retry: AgentRetryPolicy;
  policy: AgentPolicySettings;
  skillId?: string;
  selectedSkillIds: string[];
  context: Record<string, unknown>;
  tools: AgentToolDescriptor[];
  messages: Array<Pick<AgentMessage, "role" | "content">>;
}

export interface AgentRetryPolicy {
  enabled: boolean;
  maxAttempts: number;
}

export interface AgentPolicySettings {
  maxSteps: number;
  contextWarningPercent: number;
  newThreadPercent: number;
  diagnosticRetention: number;
  compatibilityReplayMessageLimit: number;
  showDeliveryTelemetry: boolean;
}

export interface AgentRunResponse {
  runId: string;
  text: string;
  nextSequence: number;
  assistantItemId: string;
  skillId?: string;
  capabilities: AgentProviderCapabilities;
  telemetry: AgentStreamingTelemetry;
  toolCalls: AgentToolCall[];
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

export type AgentStreamingBehavior = "incremental" | "burst" | "atomic" | "unknown";

export interface AgentStreamingTelemetry {
  strategy: AgentProviderStrategy;
  attempts: number;
  requestMs: number;
  firstEventMs?: number;
  firstTextMs?: number;
  textSpanMs: number;
  totalMs: number;
  textDeltaCount: number;
  textCharacterCount: number;
  p50InterDeltaMs?: number;
  p95InterDeltaMs?: number;
  densestWindowPercent: number;
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
  | { type: "event"; event: AgentEvent }
  | { type: "toolExecutionRequested"; runId: string; call: AgentToolCall };

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

export interface AgentExtension<TModel = unknown, TOperation = unknown> {
  id: string;
  fileType: string;
  skillId: string;
  tools: AgentToolDescriptor[];
  buildContext(model: TModel, activePageId: string | undefined, revision: number): Record<string, unknown>;
  executeTool(
    call: AgentToolCall,
    context: AgentToolExecutionContext<TModel>,
  ): Promise<AgentToolResult<TOperation>> | AgentToolResult<TOperation>;
  describeChangeSet(changeSet: AgentChangeSet<TOperation>): string[];
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
  createToolExecutor: () => AgentToolExecutor;
  describeChangeSet: (changeSet: AgentChangeSet) => string[];
  applyChangeSet: (changeSet: AgentChangeSet) => boolean;
}
