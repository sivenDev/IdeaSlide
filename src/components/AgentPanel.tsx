import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { Bot, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
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
  type AgentEvent,
  type AgentTurn,
} from "../lib/agent/protocol";
import type { IdeaSketchAgentOperation } from "../lib/agent/extensions/ideaSketchAgentExtension";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentThreadHeader } from "./agent/AgentThreadHeader";
import { AgentTranscript } from "./agent/AgentTranscript";
import { IdeaSketchChangeReview } from "./agent/IdeaSketchChangeReview";

function visibleResponse(text: string): string {
  return text.replace(/```ideanote-change[\s\S]*?```/gi, "").trim();
}

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
  const runGeneration = useRef(0);
  const activeRunId = useRef<string | undefined>(undefined);
  const title = binding?.document.displayName ?? "Current file";
  const bindingDocumentId = binding?.document.id;
  const bindingExtensionId = binding?.extensionId;
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
    retryPrompt,
    retryTurnId,
  } = useAgentThread({
    bindingKey: `${bindingDocumentId ?? "none"}:${bindingExtensionId ?? "none"}`,
    title,
    welcome,
    capabilities: runtime.capabilities,
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
    runGeneration.current += 1;
    const turnId = activeRunId.current;
    activeRunId.current = undefined;
    if (turnId) void runtime.cancelTurn(turnId).catch(() => undefined);
  }, [bindingDocumentId, bindingExtensionId, runtime]);

  const submit = async (prompt: string, retryOfTurnId?: string) => {
    if (!binding?.document.model || activationState !== "ready" || running) return;
    const capturedBinding = binding;
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
        context: capturedBinding.buildContext(),
        tools: capturedBinding.tools,
        messages,
      }, emit);
      if (generation !== runGeneration.current || activeRunId.current !== turnId) return;
      let sequence = result.nextSequence;
      const responseText = visibleResponse(result.text) || "I prepared a change proposal for review.";
      const proposal = capturedBinding.parseChangeSet(result.text);
      if (proposal) {
        const changeSet: AgentChangeSet = {
          ...proposal,
          baseDocumentStatus: capturedBinding.document.status,
          baseSourceModified: capturedBinding.document.sourceModified,
        };
        const reviewEvent: AgentEvent = {
          type: "itemAdded",
          eventId: createAgentEventId(turnId, sequence, "itemAdded"),
          threadId: state.thread.id,
          turnId,
          sequence,
          at: Date.now(),
          item: {
            id: `${turnId}:change-review`,
            kind: "changeReview",
            changeSet,
            status: "pending",
            createdAt: Date.now(),
          },
        };
        sequence += 1;
        emit(reviewEvent);
      }
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

  const renderChangeReview = (item: AgentChangeReviewItem) => {
    if (!binding || item.changeSet.extensionId !== binding.extensionId || binding.fileType !== "ideasketch") {
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
      <IdeaSketchChangeReview
        changeSet={item.changeSet as AgentChangeSet<IdeaSketchAgentOperation>}
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
      if (prompt) await submit(prompt);
    },
    onCancel: cancel,
  });

  if (activationState === "configuration-required") {
    return (
      <div className="ideanote-agent-empty">
        <div className="ideanote-agent-empty__icon"><Bot aria-hidden size={20} /></div>
        <h3>Configure AI Provider</h3>
        <p>AI is enabled, but a provider credential is required before the Agent can run.</p>
        <button type="button" onClick={onOpenSettings}><Settings2 aria-hidden size={14} /> Open Settings</button>
      </div>
    );
  }

  if (!binding) {
    return (
      <div className="ideanote-agent-empty">
        <div className="ideanote-agent-empty__icon"><Bot aria-hidden size={20} /></div>
        <h3>No Active Editor</h3>
        <p>Open a supported file to give the Agent editor context and tools.</p>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={assistantRuntime}>
      <ThreadPrimitive.Root className="ideanote-agent-panel">
        <AgentThreadHeader
          title={title}
          runtimeLabel={runtime.label}
          capabilities={state.capabilities}
          running={running}
          onOpenSettings={onOpenSettings}
        />
        <AgentTranscript
          state={state}
          showToolActivity={settings.agent.showToolActivity}
          onRetry={retryPrompt ? () => void submit(retryPrompt, retryTurnId) : undefined}
          renderChangeReview={renderChangeReview}
        />
        <AgentComposer
          disabled={activationState !== "ready"}
          running={running}
          steeringAvailable={state.capabilities.steering}
          retryAvailable={Boolean(retryPrompt)}
          targetLabel={binding.document.displayName ?? "Untitled"}
          onRetry={() => { if (retryPrompt) void submit(retryPrompt, retryTurnId); }}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
