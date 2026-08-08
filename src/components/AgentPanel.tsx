import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentThread } from "../hooks/useAgentThread";
import { useSettings } from "../hooks/useSettings";
import { createCompatibilityAgentRuntime } from "../lib/agent/agentRuntime";
import { discoverAgentSkills } from "../lib/agent/agentClient";
import { markAgentChangeSetApplied, markAgentChangeSetStale, rejectAgentChangeSet } from "../lib/agent/changeSet";
import { promptFromAssistantUiMessage, toAssistantUiMessage } from "../lib/agent/assistantUiAdapter";
import type { AgentChangeSet, ActiveAgentEditorBinding } from "../lib/agent/types";
import {
  createAgentEventId,
  type AgentChangeReviewItem,
  type AgentTurn,
} from "../lib/agent/protocol";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentThreadHistory } from "./agent/AgentThreadHistory";
import { AgentThreadHeader } from "./agent/AgentThreadHeader";
import { AgentTranscript } from "./agent/AgentTranscript";
import { AgentChangeReview } from "./agent/AgentChangeReview";

function turnForReview(turns: AgentTurn[], itemId: string): AgentTurn | undefined {
  return turns.find((turn) => turn.items.some((item) => item.id === itemId));
}

export function AgentPanel({
  binding,
  onOpenSettings,
}: {
  binding?: ActiveAgentEditorBinding;
  onOpenSettings: () => void;
}) {
  const { settings, activationState } = useSettings();
  const runtime = useMemo(() => createCompatibilityAgentRuntime(), []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const runGeneration = useRef(0);
  const activeRunId = useRef<string | undefined>(undefined);
  const title = binding?.document.displayName ?? "Current file";
  const bindingSkillId = binding?.skillId;
  const welcome = binding
    ? `I can inspect **${binding.document.displayName}** and prepare reviewable changes.`
    : "Open a supported file to give the Agent editor context.";
  const {
    state,
    emit,
    setNotice,
    removeNotice,
    messages,
    runtimeMessages,
    retryPrompt,
    retryTurnId,
    history,
    historyLoading,
    persistenceError,
    createThread,
    resumeThread,
    renameThread,
    archiveThread,
    loadMoreHistory,
  } = useAgentThread({
    title,
    welcome,
    capabilities: runtime.capabilities,
    runtime: {
      kind: "compatibility",
      label: runtime.label,
      model: settings.ai.model,
      degraded: !runtime.capabilities.reasoningSummary || !runtime.capabilities.steering,
    },
  });
  const running = Boolean(state.activeTurnId);

  useEffect(() => {
    if (activationState !== "ready" || !bindingSkillId) return;
    let active = true;
    discoverAgentSkills()
      .then((skills) => {
        if (!active) return;
        if (skills.some((skill) => skill.id === bindingSkillId)) {
          removeNotice("skill-discovery-error");
        } else {
          setNotice({
            id: "skill-discovery-error",
            kind: "error",
            status: "failed",
            createdAt: Date.now(),
            error: {
              code: "runtimeUnavailable",
              message: `The ${bindingSkillId} Skill is not installed.`,
              recovery: "Reinstall the application or restore its packaged Agent Skills.",
              retryable: false,
            },
          });
        }
      })
      .catch((cause) => {
        if (!active) return;
        setNotice({
          id: "skill-discovery-error",
          kind: "error",
          status: "failed",
          createdAt: Date.now(),
          error: {
            code: "runtimeUnavailable",
            message: cause instanceof Error ? cause.message : String(cause),
            recovery: "Retry after restarting the Agent or open Settings to verify AI is enabled.",
            retryable: true,
          },
        });
      });
    return () => { active = false; };
  }, [activationState, bindingSkillId, removeNotice, setNotice]);

  useEffect(() => {
    if (activationState === "ready") return;
    runGeneration.current += 1;
    const turnId = activeRunId.current;
    activeRunId.current = undefined;
    if (turnId) void runtime.cancelTurn(turnId).catch(() => undefined);
  }, [activationState, runtime]);

  useEffect(() => () => {
    const turnId = activeRunId.current;
    activeRunId.current = undefined;
    if (turnId) void runtime.cancelTurn(turnId).catch(() => undefined);
  }, [runtime]);

  const submit = async (prompt: string, retryOfTurnId?: string) => {
    if (!binding?.document.model || activationState !== "ready" || running) return;
    const capturedBinding = binding;
    const toolExecutor = capturedBinding.createToolExecutor();
    const generation = ++runGeneration.current;
    const turnId = crypto.randomUUID();
    activeRunId.current = turnId;
    try {
      const result = await runtime.startTurn({
        threadId: state.thread.id,
        turnId,
        retryOfTurnId,
        prompt,
        binding: {
          documentId: capturedBinding.document.id,
          documentName: capturedBinding.document.displayName ?? "Untitled",
          extensionId: capturedBinding.extensionId,
          fileType: capturedBinding.fileType,
          skillId: capturedBinding.skillId,
          revision: capturedBinding.document.revision,
          sourceModified: capturedBinding.document.sourceModified,
        },
        baseUrl: settings.ai.baseUrl,
        model: settings.ai.model,
        systemPrompt: settings.ai.systemPrompt,
        retry: settings.ai.retry,
        context: capturedBinding.buildContext(),
        tools: capturedBinding.tools,
        messages: runtimeMessages,
        toolExecutor,
      }, emit);
      if (generation !== runGeneration.current || activeRunId.current !== turnId) return;
      let sequence = result.nextSequence;
      const responseText = result.text.trim() || "I completed the requested editor Tool activity.";
      emit({
        type: "turnCompleted",
        eventId: createAgentEventId(turnId, sequence, "turnCompleted"),
        threadId: state.thread.id,
        turnId,
        sequence,
        at: Date.now(),
        assistantItemId: result.assistantItemId,
        finalText: responseText,
      });
    } catch {
      // The runtime emits a normalized failure Item before rejecting.
    } finally {
      if (activeRunId.current === turnId) activeRunId.current = undefined;
    }
  };

  const cancel = async () => {
    const turnId = activeRunId.current;
    if (!turnId) return;
    const activeGeneration = runGeneration.current;
    runGeneration.current += 1;
    try {
      await runtime.cancelTurn(turnId);
      if (activeRunId.current === turnId) activeRunId.current = undefined;
    } catch (cause) {
      if (activeRunId.current === turnId) runGeneration.current = activeGeneration;
      setNotice({
        id: "cancel-error",
        kind: "error",
        status: "failed",
        createdAt: Date.now(),
        error: {
          code: "runtimeUnavailable",
          message: cause instanceof Error ? cause.message : String(cause),
          recovery: "Retry cancelling or restart the Agent.",
          retryable: true,
        },
      });
    }
  };

  const steer = async (prompt: string) => {
    const turnId = activeRunId.current;
    if (!turnId || !runtime.steerTurn || !state.capabilities.steering) return;
    const accepted = await runtime.steerTurn(turnId, prompt);
    if (!accepted) return;
    const sequence = state.nextSequenceByTurn[turnId] ?? 0;
    emit({
      type: "itemAdded",
      eventId: createAgentEventId(turnId, sequence, "itemAdded"),
      threadId: state.thread.id,
      turnId,
      sequence,
      at: Date.now(),
      item: {
        id: `${turnId}:steer:${sequence}`,
        kind: "lifecycle",
        label: `Steering added: ${prompt}`,
        status: "completed",
        createdAt: Date.now(),
      },
    });
  };

  const handleHistoryAction = (action: () => Promise<void>) => {
    void action().catch((cause) => setNotice({
      id: "thread-history-error",
      kind: "error",
      status: "failed",
      createdAt: Date.now(),
      error: {
        code: "runtimeUnavailable",
        message: cause instanceof Error ? cause.message : String(cause),
        recovery: "Retry the Thread history action.",
        retryable: true,
      },
    }));
  };

  const updateReview = (item: AgentChangeReviewItem, changeSet: AgentChangeSet) => {
    const turn = turnForReview(state.thread.turns, item.id);
    if (!turn) return;
    const sequence = state.nextSequenceByTurn[turn.id] ?? 0;
    emit({
      type: "itemUpdated",
      eventId: createAgentEventId(turn.id, sequence, "itemUpdated"),
      threadId: state.thread.id,
      turnId: turn.id,
      sequence,
      at: Date.now(),
      item: {
        ...item,
        changeSet,
        status: changeSet.status === "proposed" ? "pending" : "completed",
      },
    });
  };

  const resolveApproval = async (itemId: string, approved: boolean) => {
    const turn = state.thread.turns.find((candidate) => candidate.items.some((item) => item.id === itemId));
    const item = turn?.items.find((candidate) => candidate.id === itemId);
    if (!turn || item?.kind !== "approval" || !runtime.resolveApproval) return;
    const resolved = await runtime.resolveApproval(turn.id, item.requestId, approved);
    if (!resolved) return;
    const sequence = state.nextSequenceByTurn[turn.id] ?? 0;
    emit({
      type: "approvalResolved",
      eventId: createAgentEventId(turn.id, sequence, "approvalResolved"),
      threadId: state.thread.id,
      turnId: turn.id,
      sequence,
      at: Date.now(),
      itemId,
      decision: approved ? "approved" : "rejected",
    });
  };

  const renderChangeReview = (item: AgentChangeReviewItem) => {
    if (!binding || item.changeSet.extensionId !== binding.extensionId) {
      return <div className="ideanote-agent-review is-stale">The original editor is not active. Reopen it to review this proposal.</div>;
    }
    const turn = turnForReview(state.thread.turns, item.id);
    const capturedTargetMatches = turn?.binding.documentId === binding.document.id
      && turn.binding.extensionId === binding.extensionId;
    const approve = () => {
      const { document } = binding;
      const changeSet = item.changeSet;
      if (
        !capturedTargetMatches
        || binding.readOnly
        || document.status !== "editable"
        || document.revision !== changeSet.baseRevision
        || changeSet.baseDocumentStatus !== document.status
        || changeSet.baseSourceModified !== document.sourceModified
      ) {
        updateReview(item, markAgentChangeSetStale(changeSet));
        return;
      }
      updateReview(
        item,
        binding.applyChangeSet(changeSet)
          ? markAgentChangeSetApplied(changeSet)
          : markAgentChangeSetStale(changeSet),
      );
    };
    return (
      <AgentChangeReview
        changeSet={item.changeSet}
        operationLabels={binding.describeChangeSet(item.changeSet)}
        readOnly={binding.readOnly || !capturedTargetMatches}
        onApprove={approve}
        onReject={() => updateReview(item, rejectAgentChangeSet(item.changeSet))}
        onUndo={binding.undo}
        canUndo={binding.canUndo}
      />
    );
  };

  const assistantRuntime = useExternalStoreRuntime({
    messages,
    isDisabled: activationState !== "ready",
    isRunning: running,
    convertMessage: (message) => toAssistantUiMessage(
      message,
      running && message.role === "assistant" && message.id === messages[messages.length - 1]?.id,
    ),
    onNew: async (message) => {
      const prompt = promptFromAssistantUiMessage(message);
      if (!prompt) return;
      if (running && state.capabilities.steering) await steer(prompt);
      else await submit(prompt);
    },
    onCancel: cancel,
  });

  return (
    <AssistantRuntimeProvider runtime={assistantRuntime}>
      <ThreadPrimitive.Root className="ideanote-agent-panel">
        <AgentThreadHeader
          title={state.thread.title}
          runtimeLabel={runtime.label}
          modelLabel={settings.ai.model}
          capabilities={state.capabilities}
          running={running}
          historyOpen={historyOpen}
          onNewThread={() => handleHistoryAction(createThread)}
          onToggleHistory={() => setHistoryOpen((open) => !open)}
          onOpenSettings={onOpenSettings}
        />
        {historyOpen && (
          <AgentThreadHistory
            page={history}
            currentThreadId={state.thread.id}
            loading={historyLoading}
            disabled={running}
            onResume={(threadId) => handleHistoryAction(async () => {
              await resumeThread(threadId);
              setHistoryOpen(false);
            })}
            onRename={(threadId, nextTitle) => handleHistoryAction(() => renameThread(threadId, nextTitle))}
            onArchive={(threadId) => handleHistoryAction(() => archiveThread(threadId))}
            onLoadMore={() => handleHistoryAction(loadMoreHistory)}
            onClose={() => setHistoryOpen(false)}
          />
        )}
        {persistenceError && (
          <div className="ideanote-agent-persistence-warning" role="status">{persistenceError}</div>
        )}
        {activationState === "configuration-required" && (
          <button type="button" className="ideanote-agent-configuration" onClick={onOpenSettings}>
            Configure an AI Provider credential to start new Turns.
          </button>
        )}
        <AgentTranscript
          state={state}
          showToolActivity={settings.agent.showToolActivity}
          onRetry={retryPrompt ? () => void submit(retryPrompt, retryTurnId) : undefined}
          renderChangeReview={renderChangeReview}
          onApprovalDecision={runtime.resolveApproval ? (itemId, approved) => void resolveApproval(itemId, approved) : undefined}
        />
        <AgentComposer
          disabled={activationState !== "ready" || !binding}
          running={running}
          steeringAvailable={state.capabilities.steering}
          retryAvailable={Boolean(retryPrompt)}
          targetLabel={binding?.document.displayName ?? "No active editor"}
          onRetry={() => { if (retryPrompt) void submit(retryPrompt, retryTurnId); }}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
