import type { AgentChangeSet, AgentStreamingTelemetry } from "./types";

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
  persistence: false,
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

export interface AgentReasoningSummaryItem extends AgentItemBase {
  kind: "reasoningSummary";
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
}

export interface AgentApprovalItem extends AgentItemBase {
  kind: "approval";
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
  | AgentReasoningSummaryItem
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
}

export interface AgentThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: AgentTurn[];
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
}

export interface AgentCapabilitiesUpdatedEvent extends AgentEventBase {
  type: "capabilitiesUpdated";
  capabilities: AgentCapabilities;
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

export type AgentEvent =
  | AgentTurnStartedEvent
  | AgentCapabilitiesUpdatedEvent
  | AgentItemAddedEvent
  | AgentItemDeltaEvent
  | AgentItemUpdatedEvent
  | AgentTurnCompletedEvent
  | AgentTurnFailedEvent
  | AgentTurnCancelledEvent
  | AgentTelemetryUpdatedEvent;

export function createAgentEventId(turnId: string, sequence: number, type: AgentEvent["type"]): string {
  return `${turnId}:${sequence}:${type}`;
}
