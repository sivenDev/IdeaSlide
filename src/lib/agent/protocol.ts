import type {
  AgentChangeSet,
  AgentPolicySettings,
  AgentRuntimeKind,
  AgentSkillProvenance,
  AgentStreamingTelemetry,
} from "./types";

export type AgentTurnStatus = "running" | "completed" | "cancelled" | "failed";
export type AgentItemStatus = "pending" | "running" | "completed" | "cancelled" | "failed";

export interface AgentCapabilities {
  textStreaming: boolean;
  reasoningSummary: boolean;
  plans: boolean;
  toolEvents: boolean;
  approvals: boolean;
  cancellation: boolean;
  steering: boolean;
  retry: boolean;
  persistence: boolean;
}

export const COMPATIBILITY_AGENT_CAPABILITIES: AgentCapabilities = {
  textStreaming: true,
  reasoningSummary: false,
  plans: false,
  toolEvents: false,
  approvals: false,
  cancellation: true,
  steering: false,
  retry: true,
  persistence: true,
};

export interface AgentTurnBindingSnapshot {
  documentId: string;
  documentName: string;
  extensionId: string;
  fileType: string;
  skillId: string;
  revision: number;
  sourceModified?: string;
}

interface AgentItemBase {
  id: string;
  status: AgentItemStatus;
  createdAt: number;
}

export interface AgentMessageItem extends AgentItemBase {
  kind: "message";
  role: "user" | "assistant";
  content: string;
}

export interface AgentActivityItem extends AgentItemBase {
  kind: "activity";
  content: string;
}

export interface AgentPlanStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "cancelled";
}

export interface AgentPlanItem extends AgentItemBase {
  kind: "plan";
  title: string;
  steps: AgentPlanStep[];
}

export interface AgentToolItem extends AgentItemBase {
  kind: "tool";
  name: string;
  summary?: string;
  callId?: string;
  input?: unknown;
  output?: unknown;
}

export interface AgentApprovalItem extends AgentItemBase {
  kind: "approval";
  requestId: string;
  title: string;
  description: string;
  decision?: "approved" | "rejected";
}

export interface AgentChangeReviewItem extends AgentItemBase {
  kind: "changeReview";
  changeSet: AgentChangeSet;
}

export type AgentErrorCode =
  | "configurationRequired"
  | "authenticationFailed"
  | "permissionDenied"
  | "rateLimited"
  | "networkUnavailable"
  | "tlsFailure"
  | "requestTimeout"
  | "providerUnavailable"
  | "providerProtocolError"
  | "modelUnavailable"
  | "contextLimit"
  | "toolValidationFailed"
  | "toolExecutionFailed"
  | "changeSetStale"
  | "runtimeUnavailable"
  | "cancelled"
  | "unknown";

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  recovery?: string;
  diagnosticId?: string;
  retryable: boolean;
}

export interface AgentErrorItem extends AgentItemBase {
  kind: "error";
  error: AgentError;
}

export interface AgentLifecycleItem extends AgentItemBase {
  kind: "lifecycle";
  label: string;
}

export type AgentItem =
  | AgentMessageItem
  | AgentActivityItem
  | AgentPlanItem
  | AgentToolItem
  | AgentApprovalItem
  | AgentChangeReviewItem
  | AgentErrorItem
  | AgentLifecycleItem;

export interface AgentTurn {
  id: string;
  threadId: string;
  retryOfTurnId?: string;
  status: AgentTurnStatus;
  createdAt: number;
  completedAt?: number;
  binding: AgentTurnBindingSnapshot;
  items: AgentItem[];
  telemetry?: AgentStreamingTelemetry;
  effectivePolicy?: AgentEffectivePolicy;
  skillProvenance: AgentSkillProvenance[];
}

export interface AgentThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: AgentTurn[];
}

export interface AgentThreadRuntimeMetadata {
  kind: AgentRuntimeKind;
  label: string;
  model: string;
  upstreamThreadId?: string;
  localReplayTruncatedBeforeTurnId?: string;
  /** Legacy persisted name retained for migration only. */
  compactedBeforeTurnId?: string;
  diagnostic?: string;
  degraded: boolean;
  health?: AgentRuntimeHealth;
}

export type AgentRuntimeHealth = "healthy" | "degraded" | "unavailable" | "unknown";

export interface AgentTokenUsageBreakdown {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export interface AgentContextSnapshot {
  status: "available" | "unavailable" | "unknown";
  source: "runtime" | "provider" | "none";
  total?: AgentTokenUsageBreakdown;
  last?: AgentTokenUsageBreakdown;
  modelContextWindow?: number;
  usedPercent?: number;
  runtimeCompactedAt?: number;
  runtimeCompactedTurnId?: string;
  localReplayTruncatedBeforeTurnId?: string;
  message?: string;
}

export interface AgentEffectivePolicy extends AgentPolicySettings {
  capturedAt: number;
}

export type AgentRuntimeDiagnosticCategory =
  | "discovery"
  | "startup"
  | "selection"
  | "fallback"
  | "retry"
  | "provider"
  | "cancellation"
  | "terminal"
  | "compaction"
  | "policy";

export interface AgentRuntimeDiagnostic {
  id: string;
  at: number;
  category: AgentRuntimeDiagnosticCategory;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  recovery?: string;
  retryable: boolean;
}

export interface AgentThreadRecord {
  schemaVersion: 1;
  thread: AgentThread;
  capabilities: AgentCapabilities;
  runtime: AgentThreadRuntimeMetadata;
  context?: AgentContextSnapshot;
  runtimeDiagnostics?: AgentRuntimeDiagnostic[];
  archivedAt?: number;
}

export interface AgentThreadSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turnCount: number;
  archivedAt?: number;
  runtime: AgentThreadRuntimeMetadata;
}

export interface AgentThreadPage {
  threads: AgentThreadSummary[];
  nextCursor?: string;
  recoveredCorruptEntries: number;
}

export interface AgentDiagnostic {
  code:
    | "duplicateEvent"
    | "lateEvent"
    | "missingSequence"
    | "invalidDelta"
    | "foreignThread"
    | "unknownTurn"
    | "terminalEvent";
  message: string;
  eventId: string;
  turnId: string;
}

export interface AgentThreadState {
  thread: AgentThread;
  capabilities: AgentCapabilities;
  runtime: AgentThreadRuntimeMetadata;
  context: AgentContextSnapshot;
  runtimeDiagnostics: AgentRuntimeDiagnostic[];
  activeTurnId?: string;
  notices: AgentItem[];
  processedEventIds: Record<string, true>;
  nextSequenceByTurn: Record<string, number>;
  pendingEventsByTurn: Record<string, Record<number, AgentEvent>>;
  diagnostics: AgentDiagnostic[];
}

interface AgentEventBase {
  eventId: string;
  threadId: string;
  turnId: string;
  sequence: number;
  at: number;
}

export interface AgentTurnStartedEvent extends AgentEventBase {
  type: "turnStarted";
  prompt: string;
  retryOfTurnId?: string;
  binding: AgentTurnBindingSnapshot;
  userItemId: string;
  assistantItemId: string;
  skillProvenance: AgentSkillProvenance[];
  effectivePolicy: AgentEffectivePolicy;
}

export interface AgentSkillActivatedEvent extends AgentEventBase {
  type: "skillActivated";
  provenance: AgentSkillProvenance;
}

export interface AgentCapabilitiesUpdatedEvent extends AgentEventBase {
  type: "capabilitiesUpdated";
  capabilities: AgentCapabilities;
}

export interface AgentRuntimeUpdatedEvent extends AgentEventBase {
  type: "runtimeUpdated";
  runtime: AgentThreadRuntimeMetadata;
}

export interface AgentRuntimeDiagnosticRecordedEvent extends AgentEventBase {
  type: "runtimeDiagnosticRecorded";
  diagnostic: AgentRuntimeDiagnostic;
}

export interface AgentContextUpdatedEvent extends AgentEventBase {
  type: "contextUpdated";
  context: Partial<AgentContextSnapshot>;
}

export interface AgentItemAddedEvent extends AgentEventBase {
  type: "itemAdded";
  item: AgentItem;
}

export interface AgentItemDeltaEvent extends AgentEventBase {
  type: "itemDelta";
  itemId: string;
  text: string;
}

export interface AgentItemUpdatedEvent extends AgentEventBase {
  type: "itemUpdated";
  item: AgentItem;
}

export interface AgentTurnCompletedEvent extends AgentEventBase {
  type: "turnCompleted";
  assistantItemId: string;
  finalText: string;
}

export interface AgentTurnFailedEvent extends AgentEventBase {
  type: "turnFailed";
  assistantItemId: string;
  error: AgentError;
}

export interface AgentTurnCancelledEvent extends AgentEventBase {
  type: "turnCancelled";
  label?: string;
}

export interface AgentTelemetryUpdatedEvent extends AgentEventBase {
  type: "telemetryUpdated";
  telemetry: AgentStreamingTelemetry;
}

export interface AgentPlanUpdatedEvent extends AgentEventBase {
  type: "planUpdated";
  item: AgentPlanItem;
}

export interface AgentApprovalRequestedEvent extends AgentEventBase {
  type: "approvalRequested";
  item: AgentApprovalItem;
}

export interface AgentApprovalResolvedEvent extends AgentEventBase {
  type: "approvalResolved";
  itemId: string;
  decision: "approved" | "rejected";
}

export type AgentEvent =
  | AgentTurnStartedEvent
  | AgentCapabilitiesUpdatedEvent
  | AgentRuntimeUpdatedEvent
  | AgentRuntimeDiagnosticRecordedEvent
  | AgentContextUpdatedEvent
  | AgentSkillActivatedEvent
  | AgentItemAddedEvent
  | AgentItemDeltaEvent
  | AgentItemUpdatedEvent
  | AgentTurnCompletedEvent
  | AgentTurnFailedEvent
  | AgentTurnCancelledEvent
  | AgentTelemetryUpdatedEvent
  | AgentPlanUpdatedEvent
  | AgentApprovalRequestedEvent
  | AgentApprovalResolvedEvent;

export function createAgentEventId(turnId: string, sequence: number, type: AgentEvent["type"]): string {
  return `${turnId}:${sequence}:${type}`;
}

export function createSettledTurnCompletedEvent({
  threadId,
  turnId,
  nextSequence,
  assistantItemId,
  finalText,
  at = Date.now(),
}: {
  threadId: string;
  turnId: string;
  nextSequence: number;
  assistantItemId: string;
  finalText: string;
  at?: number;
}): AgentTurnCompletedEvent {
  const sequence = Math.max(0, nextSequence - 1);
  return {
    type: "turnCompleted",
    eventId: createAgentEventId(turnId, sequence, "turnCompleted"),
    threadId,
    turnId,
    sequence,
    at,
    assistantItemId,
    finalText,
  };
}
