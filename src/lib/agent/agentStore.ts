import type { AgentMessage, AgentStreamingTelemetry } from "./types";
import type {
  AgentCapabilities,
  AgentDiagnostic,
  AgentError,
  AgentEvent,
  AgentItem,
  AgentMessageItem,
  AgentThreadState,
  AgentThreadTitleSource,
  AgentThreadRecord,
  AgentThreadRuntimeMetadata,
  AgentTurn,
} from "./protocol";
import {
  generateAgentThreadTitle,
  NEW_AGENT_THREAD_TITLE,
  normalizeAgentThreadTitleSource,
} from "./agentThreadTitle.ts";

export function createAgentThreadState({
  threadId,
  title,
  welcome,
  capabilities,
  runtime = {
    kind: "compatibility",
    label: "Compatibility",
    model: "",
    degraded: true,
    health: "unknown",
  },
  titleSource = "initial",
  now = Date.now(),
}: {
  threadId: string;
  title: string;
  welcome: string;
  capabilities: AgentCapabilities;
  runtime?: AgentThreadRuntimeMetadata;
  titleSource?: AgentThreadTitleSource;
  now?: number;
}): AgentThreadState {
  const welcomeTurn: AgentTurn = {
    id: `${threadId}:welcome`,
    threadId,
    status: "completed",
    createdAt: now,
    completedAt: now,
    binding: {
      documentId: "",
      documentName: title,
      extensionId: "",
      fileType: "",
      skillId: "",
      revision: 0,
    },
    skillProvenance: [],
    items: [{
      id: `${threadId}:welcome:message`,
      kind: "message",
      role: "assistant",
      content: welcome,
      status: "completed",
      createdAt: now,
    }],
  };
  return {
    thread: { id: threadId, title, titleSource, createdAt: now, updatedAt: now, turns: [welcomeTurn] },
    capabilities,
    runtime: normalizeRuntimeMetadata(runtime),
    context: unavailableContext(runtime.localReplayTruncatedBeforeTurnId ?? runtime.compactedBeforeTurnId),
    runtimeDiagnostics: [],
    notices: [],
    processedEventIds: {},
    nextSequenceByTurn: {},
    pendingEventsByTurn: {},
    diagnostics: [],
  };
}

export function hydrateAgentThreadState(record: AgentThreadRecord): AgentThreadState {
  const thread = {
    ...record.thread,
    titleSource: normalizeAgentThreadTitleSource(record.thread.titleSource),
    turns: record.thread.turns.map((turn) => ({
      ...turn,
      skillProvenance: turn.skillProvenance ?? [],
      ...(turn.telemetry ? { telemetry: normalizeStreamingTelemetry(turn.telemetry) } : {}),
      items: turn.items.filter((item) => (
        item.kind !== "changeReview"
        && !(turn.status === "completed" && item.id === `${turn.id}:activity`)
      )),
    })),
  };
  return {
    thread,
    capabilities: { ...record.capabilities, persistence: true },
    runtime: normalizeRuntimeMetadata(record.runtime),
    context: {
      ...(record.context ?? unavailableContext(
        record.runtime.localReplayTruncatedBeforeTurnId ?? record.runtime.compactedBeforeTurnId,
      )),
      localReplayTruncatedBeforeTurnId: record.context?.localReplayTruncatedBeforeTurnId
        ?? record.runtime.localReplayTruncatedBeforeTurnId
        ?? record.runtime.compactedBeforeTurnId,
    },
    runtimeDiagnostics: record.runtimeDiagnostics ?? [],
    notices: [],
    processedEventIds: {},
    nextSequenceByTurn: {},
    pendingEventsByTurn: {},
    diagnostics: [],
  };
}

function normalizeRuntimeMetadata(runtime: AgentThreadRuntimeMetadata): AgentThreadRuntimeMetadata {
  const localReplayTruncatedBeforeTurnId = runtime.localReplayTruncatedBeforeTurnId
    ?? runtime.compactedBeforeTurnId;
  return {
    ...runtime,
    localReplayTruncatedBeforeTurnId,
    health: runtime.health ?? (runtime.degraded ? "degraded" : "healthy"),
  };
}

function unavailableContext(localReplayTruncatedBeforeTurnId?: string) {
  return {
    status: "unavailable" as const,
    source: "none" as const,
    localReplayTruncatedBeforeTurnId,
    message: "This runtime has not supplied exact token usage.",
  };
}

function normalizeStreamingTelemetry(telemetry: AgentStreamingTelemetry): AgentStreamingTelemetry {
  const legacy = telemetry as unknown as Omit<AgentStreamingTelemetry, "behavior"> & {
    eventSpanMs?: number;
    eventCount?: number;
    behavior: AgentStreamingTelemetry["behavior"] | "buffered" | "indeterminate";
  };
  const behavior = legacy.behavior === "buffered"
    ? "burst"
    : legacy.behavior === "indeterminate"
      ? "unknown"
      : legacy.behavior;
  return {
    strategy: legacy.strategy,
    attempts: legacy.attempts,
    requestMs: legacy.requestMs,
    firstEventMs: legacy.firstEventMs,
    firstTextMs: legacy.firstTextMs,
    textSpanMs: legacy.textSpanMs ?? legacy.eventSpanMs ?? 0,
    totalMs: legacy.totalMs,
    textDeltaCount: legacy.textDeltaCount ?? legacy.eventCount ?? 0,
    textCharacterCount: legacy.textCharacterCount ?? 0,
    p50InterDeltaMs: legacy.p50InterDeltaMs,
    p95InterDeltaMs: legacy.p95InterDeltaMs,
    densestWindowPercent: legacy.densestWindowPercent ?? (behavior === "burst" ? 100 : 0),
    behavior,
  };
}

export function renameAgentThreadState(
  state: AgentThreadState,
  title: string,
  titleSource: AgentThreadTitleSource = "manual",
  now = Date.now(),
): AgentThreadState {
  return {
    ...state,
    thread: { ...state.thread, title, titleSource, updatedAt: now },
  };
}

export function prepareAgentThreadTitleState(
  state: AgentThreadState,
  prompt: string,
  now = Date.now(),
): AgentThreadState {
  if (state.thread.titleSource !== "initial") return state;
  const title = generateAgentThreadTitle(prompt);
  if (title === NEW_AGENT_THREAD_TITLE) return state;
  return renameAgentThreadState(state, title, "generated", now);
}

function withDiagnostic(
  state: AgentThreadState,
  event: AgentEvent,
  code: AgentDiagnostic["code"],
  message: string,
): AgentThreadState {
  return {
    ...state,
    diagnostics: [...state.diagnostics, { code, message, eventId: event.eventId, turnId: event.turnId }].slice(-100),
  };
}

function updateTurn(
  state: AgentThreadState,
  turnId: string,
  update: (turn: AgentTurn) => AgentTurn,
): AgentThreadState {
  let found = false;
  const turns = state.thread.turns.map((turn) => {
    if (turn.id !== turnId) return turn;
    found = true;
    return update(turn);
  });
  if (!found) return state;
  return {
    ...state,
    thread: { ...state.thread, turns },
  };
}

function updateItem(turn: AgentTurn, itemId: string, update: (item: AgentItem) => AgentItem): AgentTurn {
  return {
    ...turn,
    items: turn.items.map((item) => item.id === itemId ? update(item) : item),
  };
}

function applyOrderedEvent(state: AgentThreadState, event: AgentEvent): AgentThreadState {
  const existingTurn = state.thread.turns.find((turn) => turn.id === event.turnId);
  if (!existingTurn && event.type !== "turnStarted") {
    return withDiagnostic(state, event, "unknownTurn", `Turn ${event.turnId} does not exist.`);
  }
  if (existingTurn && existingTurn.status !== "running" && event.type !== "itemUpdated") {
    return withDiagnostic(
      state,
      event,
      "terminalEvent",
      `Ignored ${event.type} because Turn ${event.turnId} is already ${existingTurn.status}.`,
    );
  }
  switch (event.type) {
    case "turnStarted": {
      if (state.thread.turns.some((turn) => turn.id === event.turnId)) return state;
      const turn: AgentTurn = {
        id: event.turnId,
        threadId: event.threadId,
        retryOfTurnId: event.retryOfTurnId,
        status: "running",
        createdAt: event.at,
        binding: event.binding,
        effectivePolicy: event.effectivePolicy,
        skillProvenance: event.skillProvenance ?? [],
        items: [
          {
            id: event.userItemId,
            kind: "message",
            role: "user",
            content: event.prompt,
            status: "completed",
            createdAt: event.at,
          },
          {
            id: `${event.turnId}:activity`,
            kind: "lifecycle",
            label: "Preparing",
            status: "running",
            createdAt: event.at,
          },
        ],
      };
      return {
        ...state,
        activeTurnId: event.turnId,
        thread: {
          ...state.thread,
          updatedAt: event.at,
          turns: [...state.thread.turns, turn],
        },
      };
    }
    case "capabilitiesUpdated":
      return { ...state, capabilities: event.capabilities };
    case "runtimeUpdated":
      return {
        ...updateTurn(state, event.turnId, (turn) => turn.evidence
          ? turn
          : {
            ...turn,
            evidence: {
              runtimeKind: event.runtime.kind,
              runtimeLabel: event.runtime.label,
              model: event.runtime.model,
              reasoningEffort: event.runtime.reasoningEffort ?? "standard",
              capturedAt: event.at,
            },
          }),
        runtime: normalizeRuntimeMetadata({
          ...event.runtime,
          upstreamThreadId: event.runtime.upstreamThreadId ?? state.runtime.upstreamThreadId,
          upstreamToolSignature: event.runtime.upstreamToolSignature ?? state.runtime.upstreamToolSignature,
        }),
      };
    case "runtimeDiagnosticRecorded": {
      const turn = state.thread.turns.find((candidate) => candidate.id === event.turnId);
      const retention = Math.min(100, Math.max(5, turn?.effectivePolicy?.diagnosticRetention ?? 20));
      return {
        ...state,
        runtimeDiagnostics: [...state.runtimeDiagnostics, event.diagnostic].slice(-retention),
      };
    }
    case "contextUpdated": {
      const exactUsage = event.context.status && event.context.status !== "available"
        ? {
            total: undefined,
            last: undefined,
            modelContextWindow: undefined,
            usedPercent: undefined,
          }
        : {};
      return {
        ...state,
        context: {
          ...state.context,
          ...exactUsage,
          ...event.context,
          localReplayTruncatedBeforeTurnId: event.context.localReplayTruncatedBeforeTurnId
            ?? state.context.localReplayTruncatedBeforeTurnId,
        },
      };
    }
    case "skillActivated":
      return updateTurn(state, event.turnId, (turn) => turn.skillProvenance.some((skill) => skill.id === event.provenance.id)
        ? turn
        : { ...turn, skillProvenance: [...turn.skillProvenance, event.provenance] });
    case "itemAdded":
      return updateTurn(state, event.turnId, (turn) => (
        turn.items.some((item) => item.id === event.item.id)
          ? turn
          : { ...turn, items: [...turn.items, event.item] }
      ));
    case "itemDelta": {
      let valid = false;
      const next = updateTurn(state, event.turnId, (turn) => updateItem(turn, event.itemId, (item) => {
        if (item.kind !== "message" && item.kind !== "activity") return item;
        valid = true;
        return { ...item, content: `${item.content}${event.text}` };
      }));
      return valid ? next : withDiagnostic(next, event, "invalidDelta", `Item ${event.itemId} cannot accept text deltas.`);
    }
    case "itemUpdated":
      return updateTurn(state, event.turnId, (turn) => updateItem(turn, event.item.id, () => event.item));
    case "planUpdated":
      return updateTurn(state, event.turnId, (turn) => (
        turn.items.some((item) => item.id === event.item.id)
          ? updateItem(turn, event.item.id, () => event.item)
          : { ...turn, items: [...turn.items, event.item] }
      ));
    case "approvalRequested":
      return updateTurn(state, event.turnId, (turn) => (
        turn.items.some((item) => item.id === event.item.id)
          ? turn
          : { ...turn, items: [...turn.items, event.item] }
      ));
    case "approvalResolved":
      return updateTurn(state, event.turnId, (turn) => updateItem(turn, event.itemId, (item) => (
        item.kind === "approval"
          ? { ...item, decision: event.decision, status: "completed" }
          : item
      )));
    case "telemetryUpdated": {
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        telemetry: event.telemetry,
      }));
    }
    case "turnCompleted": {
      const completed = updateTurn(state, event.turnId, (turn) => {
        const existingMessage = turn.items.find((item) => item.id === event.assistantItemId);
        const withMessage = existingMessage
          ? updateItem(turn, event.assistantItemId, (item) => {
            if (item.kind !== "message") return item;
            const finalText = event.finalText.startsWith(item.content) || !item.content
              ? event.finalText
              : item.content.startsWith(event.finalText)
                ? item.content
                : event.finalText;
            return { ...item, content: finalText, status: "completed" };
          })
          : {
            ...turn,
            items: [...turn.items, {
              id: event.assistantItemId,
              kind: "message" as const,
              role: "assistant" as const,
              content: event.finalText,
              status: "completed" as const,
              createdAt: event.at,
            }],
          };
        return {
          ...withMessage,
          status: "completed",
          completedAt: event.at,
          items: withMessage.items.filter((item) => item.id !== `${event.turnId}:activity`),
        };
      });
      return {
        ...completed,
        activeTurnId: completed.activeTurnId === event.turnId ? undefined : completed.activeTurnId,
        thread: { ...completed.thread, updatedAt: event.at },
      };
    }
    case "turnFailed": {
      const failed = updateTurn(state, event.turnId, (turn) => {
        const withMessage = updateItem(turn, event.assistantItemId, (item) => (
          item.kind === "message" ? { ...item, status: "failed" } : item
        ));
        return {
          ...withMessage,
          status: "failed",
          completedAt: event.at,
          items: [
            ...withMessage.items.map((item) => item.id === `${event.turnId}:activity`
              ? { ...item, label: "Failed", status: "failed" as const }
              : item),
            {
              id: `${event.turnId}:error`,
              kind: "error",
              error: event.error,
              status: "failed",
              createdAt: event.at,
            },
          ],
        };
      });
      return {
        ...failed,
        activeTurnId: failed.activeTurnId === event.turnId ? undefined : failed.activeTurnId,
        thread: { ...failed.thread, updatedAt: event.at },
      };
    }
    case "turnCancelled": {
      const cancelled = updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        status: "cancelled",
        completedAt: event.at,
        items: turn.items.map((item) => item.id === `${event.turnId}:activity`
          ? { ...item, label: event.label ?? "Turn cancelled", status: "cancelled" as const }
          : item.status === "running"
            ? { ...item, status: "cancelled" as const }
            : item),
      }));
      return {
        ...cancelled,
        activeTurnId: cancelled.activeTurnId === event.turnId ? undefined : cancelled.activeTurnId,
        thread: { ...cancelled.thread, updatedAt: event.at },
      };
    }
  }
}

function markProcessed(state: AgentThreadState, event: AgentEvent): AgentThreadState {
  return {
    ...state,
    processedEventIds: { ...state.processedEventIds, [event.eventId]: true },
    nextSequenceByTurn: {
      ...state.nextSequenceByTurn,
      [event.turnId]: event.sequence + 1,
    },
  };
}

function applyAndFlush(state: AgentThreadState, event: AgentEvent): AgentThreadState {
  let next = markProcessed(applyOrderedEvent(state, event), event);
  let expected = next.nextSequenceByTurn[event.turnId] ?? 0;
  let pendingForTurn = next.pendingEventsByTurn[event.turnId] ?? {};
  while (pendingForTurn[expected]) {
    const pending = pendingForTurn[expected];
    const remaining = { ...pendingForTurn };
    delete remaining[expected];
    next = {
      ...next,
      pendingEventsByTurn: { ...next.pendingEventsByTurn, [event.turnId]: remaining },
    };
    next = markProcessed(applyOrderedEvent(next, pending), pending);
    expected = next.nextSequenceByTurn[event.turnId] ?? expected + 1;
    pendingForTurn = next.pendingEventsByTurn[event.turnId] ?? {};
  }
  return next;
}

export function reduceAgentEvent(state: AgentThreadState, event: AgentEvent): AgentThreadState {
  if (event.threadId !== state.thread.id) {
    return withDiagnostic(
      state,
      event,
      "foreignThread",
      `Event belongs to Thread ${event.threadId}, not ${state.thread.id}.`,
    );
  }
  if (state.processedEventIds[event.eventId]) {
    return withDiagnostic(state, event, "duplicateEvent", `Duplicate event ${event.eventId} was ignored.`);
  }
  const expected = state.nextSequenceByTurn[event.turnId] ?? 0;
  if (event.sequence < expected) {
    return withDiagnostic(state, event, "lateEvent", `Late sequence ${event.sequence}; expected ${expected}.`);
  }
  if (event.sequence > expected) {
    const pendingForTurn = state.pendingEventsByTurn[event.turnId] ?? {};
    if (pendingForTurn[event.sequence]) {
      return withDiagnostic(state, event, "duplicateEvent", `Sequence ${event.sequence} is already buffered.`);
    }
    return withDiagnostic({
      ...state,
      pendingEventsByTurn: {
        ...state.pendingEventsByTurn,
        [event.turnId]: { ...pendingForTurn, [event.sequence]: event },
      },
    }, event, "missingSequence", `Buffered sequence ${event.sequence}; waiting for ${expected}.`);
  }
  return applyAndFlush(state, event);
}

export function reconcileSettledAgentTurn(
  state: AgentThreadState,
  turnId: string,
  outcome: "failed" | "cancelled",
  error?: AgentError,
  at = Date.now(),
): AgentThreadState {
  const turn = state.thread.turns.find((candidate) => candidate.id === turnId);
  if (state.activeTurnId !== turnId || turn?.status !== "running") return state;
  const sequence = state.nextSequenceByTurn[turnId] ?? 0;
  if (outcome === "cancelled") {
    return reduceAgentEvent(state, {
      type: "turnCancelled",
      eventId: `${turnId}:${sequence}:turnCancelled`,
      threadId: state.thread.id,
      turnId,
      sequence,
      at,
      label: "Agent run cancelled",
    });
  }
  return reduceAgentEvent(state, {
    type: "turnFailed",
    eventId: `${turnId}:${sequence}:turnFailed`,
    threadId: state.thread.id,
    turnId,
    sequence,
    at,
    assistantItemId: `${turnId}:assistant`,
    error: error ?? {
      code: "runtimeUnavailable",
      message: "Agent runtime ended before producing a terminal result.",
      recovery: "Retry the Turn. If the problem persists, restart the Agent.",
      retryable: true,
    },
  });
}

export function upsertAgentNotice(state: AgentThreadState, item: AgentItem): AgentThreadState {
  const exists = state.notices.some((notice) => notice.id === item.id);
  return {
    ...state,
    notices: exists
      ? state.notices.map((notice) => notice.id === item.id ? item : notice)
      : [...state.notices, item],
  };
}

export function removeAgentNotice(state: AgentThreadState, itemId: string): AgentThreadState {
  return { ...state, notices: state.notices.filter((item) => item.id !== itemId) };
}

export function agentMessagesFromState(state: AgentThreadState): AgentMessage[] {
  return state.thread.turns.flatMap((turn) => turn.items)
    .filter((item): item is AgentMessageItem => item.kind === "message" && Boolean(item.content))
    .map((item) => ({ id: item.id, role: item.role, content: item.content, createdAt: item.createdAt }));
}

export function agentRuntimeMessagesFromState(
  state: AgentThreadState,
  maxMessages = 60,
): { messages: AgentMessage[]; localReplayTruncatedBeforeTurnId?: string } {
  const messages = agentMessagesFromState(state);
  if (messages.length <= maxMessages) return { messages };
  const retained = messages.slice(-maxMessages);
  const firstRetainedId = retained[0]?.id;
  const firstRetainedTurnIndex = state.thread.turns.findIndex((turn) => (
    turn.items.some((item) => item.id === firstRetainedId)
  ));
  const localReplayTruncatedBeforeTurnId = firstRetainedTurnIndex > 0
    ? state.thread.turns[firstRetainedTurnIndex - 1]?.id
    : undefined;
  return { messages: retained, localReplayTruncatedBeforeTurnId };
}

export function retryPromptFromState(state: AgentThreadState): string | undefined {
  const turn = [...state.thread.turns].reverse().find((candidate) => (
    candidate.status === "failed" || candidate.status === "cancelled"
  ));
  const userMessage = turn?.items.find((item): item is AgentMessageItem => (
    item.kind === "message" && item.role === "user"
  ));
  return userMessage?.content;
}

export function retryTurnIdFromState(state: AgentThreadState): string | undefined {
  return [...state.thread.turns].reverse().find((candidate) => (
    candidate.status === "failed" || candidate.status === "cancelled"
  ))?.id;
}

export function totalAgentItemCount(state: AgentThreadState): number {
  return state.notices.length + state.thread.turns.reduce((count, turn) => count + turn.items.length, 0);
}
