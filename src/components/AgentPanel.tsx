import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentThread } from "../hooks/useAgentThread";
import { useAgentPresentation } from "../hooks/useAgentPresentation";
import { useSettings } from "../hooks/useSettings";
import { createNativeAgentRuntime } from "../lib/agent/agentRuntime";
import { selectAgentDiagnosticView } from "../lib/agent/agentDiagnostics";
import { createDirectApplyToolExecutor } from "../lib/agent/agentToolHost";
import { discoverAgentSkills } from "../lib/agent/agentClient";
import { promptFromAssistantUiMessage, toAssistantUiMessage } from "../lib/agent/assistantUiAdapter";
import type { ActiveAgentEditorBinding } from "../lib/agent/types";
import { createAgentEventId } from "../lib/agent/protocol";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentConversationSelector } from "./agent/AgentConversationSelector";
import { AgentRuntimeInspector } from "./agent/AgentRuntimeInspector";
import { AgentThreadHeader } from "./agent/AgentThreadHeader";
import { AgentTranscript } from "./agent/AgentTranscript";

export function AgentPanel({
  binding,
  onOpenSettings,
  onClose,
}: {
  binding?: ActiveAgentEditorBinding;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const { settings, activationState } = useSettings();
  const runtime = useMemo(() => createNativeAgentRuntime(), []);
  const agentPolicy = useMemo(() => ({
    maxSteps: settings.agent.maxSteps,
    contextWarningPercent: settings.agent.contextWarningPercent,
    newThreadPercent: settings.agent.newThreadPercent,
    diagnosticRetention: settings.agent.diagnosticRetention,
    compatibilityReplayMessageLimit: settings.agent.compatibilityReplayMessageLimit,
    showDeliveryTelemetry: settings.agent.showDeliveryTelemetry,
  }), [settings.agent]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const modelOptions = useMemo(() => Array.from(new Set([
    settings.ai.model,
    ...settings.ai.availableModels,
  ].map((model) => model.trim()).filter(Boolean))), [settings.ai.availableModels, settings.ai.model]);
  const [selectedModel, setSelectedModel] = useState(settings.ai.model);
  const currentTurnIdRef = useRef<string | undefined>(undefined);
  const cancelledTurnIdsRef = useRef(new Set<string>());
  const bindingRef = useRef(binding);
  bindingRef.current = binding;
  const title = binding?.document.displayName ?? "Current file";
  const bindingSkillId = binding?.skillId;
  const welcome = binding
    ? `I can inspect and edit **${binding.document.displayName}**. Editor changes use native Undo and Redo when the active editor supports them.`
    : "Open a supported file to give the Agent editor context.";
  const {
    state,
    emit,
    setNotice,
    removeNotice,
    settleTurn,
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
    deleteThread,
    loadMoreHistory,
  } = useAgentThread({
    title,
    welcome,
    capabilities: runtime.capabilities,
    runtime: {
      kind: "compatibility",
      label: "Compatibility",
      model: settings.ai.model,
      diagnostic: "Codex app-server is selected automatically when the pinned runtime is available.",
      degraded: !runtime.capabilities.steering,
      health: "unknown",
    },
    policy: agentPolicy,
  });
  const running = Boolean(state.activeTurnId);
  const diagnosticPolicy = state.thread.turns[state.thread.turns.length - 1]?.effectivePolicy ?? agentPolicy;
  const diagnosticView = useMemo(
    () => selectAgentDiagnosticView(state, diagnosticPolicy),
    [diagnosticPolicy, state],
  );
  const presentation = useAgentPresentation(state);
  currentTurnIdRef.current = state.activeTurnId;

  useEffect(() => {
    if (!modelOptions.includes(selectedModel)) setSelectedModel(settings.ai.model);
  }, [modelOptions, selectedModel, settings.ai.model]);

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
    const turnId = state.activeTurnId;
    if (!turnId) return;
    cancelledTurnIdsRef.current.add(turnId);
    void runtime.cancelTurn(turnId)
      .catch(() => false)
      .finally(() => settleTurn(turnId, "cancelled"));
  }, [activationState, runtime, settleTurn, state.activeTurnId]);

  useEffect(() => () => {
    const turnId = currentTurnIdRef.current;
    if (turnId) void runtime.cancelTurn(turnId).catch(() => undefined);
  }, [runtime]);

  const submit = async (prompt: string, retryOfTurnId?: string) => {
    if (!binding?.document.model || activationState !== "ready" || running) return;
    const capturedBinding = binding;
    const capturedDocument = capturedBinding.document;
    const turnId = crypto.randomUUID();
    let turnOpen = true;
    const toolExecutor = createDirectApplyToolExecutor({
      executor: capturedBinding.createToolExecutor(),
      capturedTarget: {
        documentId: capturedDocument.id,
        extensionId: capturedBinding.extensionId,
        revision: capturedDocument.revision,
        documentStatus: capturedDocument.status,
        sourceModified: capturedDocument.sourceModified,
      },
      getActiveBinding: () => bindingRef.current,
      isActive: () => turnOpen && !cancelledTurnIdsRef.current.has(turnId),
    });
    let failure: unknown;
    try {
      await runtime.startTurn({
        threadId: state.thread.id,
        turnId,
        retryOfTurnId,
        upstreamThreadId: state.runtime.upstreamThreadId,
        upstreamToolSignature: state.runtime.upstreamToolSignature,
        prompt,
        binding: {
          documentId: capturedDocument.id,
          documentName: capturedDocument.displayName ?? "Untitled",
          extensionId: capturedBinding.extensionId,
          fileType: capturedBinding.fileType,
          skillId: capturedBinding.skillId,
          revision: capturedDocument.revision,
          sourceModified: capturedDocument.sourceModified,
        },
        baseUrl: settings.ai.baseUrl,
        model: selectedModel,
        availableModels: modelOptions,
        reasoningEffort: "standard",
        systemPrompt: settings.ai.systemPrompt,
        retry: settings.ai.retry,
        policy: agentPolicy,
        selectedSkillIds: [],
        context: capturedBinding.buildContext(),
        tools: capturedBinding.tools,
        messages: runtimeMessages,
        toolExecutor,
      }, emit);
    } catch (cause) {
      failure = cause;
    } finally {
      turnOpen = false;
      if (cancelledTurnIdsRef.current.delete(turnId)) {
        settleTurn(turnId, "cancelled");
      } else {
        settleTurn(turnId, "failed", {
          code: "runtimeUnavailable",
          message: failure instanceof Error
            ? failure.message
            : failure === undefined
              ? "Agent runtime completed without a terminal event."
              : String(failure),
          recovery: "Retry the Turn. If the problem persists, restart the Agent.",
          retryable: true,
        });
      }
    }
  };

  const cancel = async () => {
    const turnId = state.activeTurnId;
    if (!turnId) return;
    cancelledTurnIdsRef.current.add(turnId);
    try {
      await runtime.cancelTurn(turnId);
      settleTurn(turnId, "cancelled");
    } catch (cause) {
      settleTurn(turnId, "failed", {
        code: "runtimeUnavailable",
        message: cause instanceof Error ? cause.message : String(cause),
        recovery: "Restart the Agent before starting another Turn.",
        retryable: true,
      });
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
    const turnId = state.activeTurnId;
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

  const runThreadAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (cause) {
      setNotice({
        id: "thread-history-error",
        kind: "error",
        status: "failed",
        createdAt: Date.now(),
        error: {
          code: "runtimeUnavailable",
          message: cause instanceof Error ? cause.message : String(cause),
          recovery: "Retry the conversation action.",
          retryable: true,
        },
      });
    }
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
          conversationSelector={(
            <AgentConversationSelector
              page={history}
              currentThreadId={state.thread.id}
              currentTitle={state.thread.title}
              currentTurnCount={state.thread.turns.length}
              loading={historyLoading}
              running={running}
              statusLabel={diagnosticView.label}
              onResume={resumeThread}
              onRename={renameThread}
              onDelete={deleteThread}
              onLoadMore={loadMoreHistory}
            />
          )}
          running={running}
          onNewThread={() => { void runThreadAction(createThread); }}
          onOpenInspector={() => setInspectorOpen(true)}
          onOpenSettings={onOpenSettings}
          onClose={onClose}
        />
        <AgentRuntimeInspector
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
          state={state}
          policy={agentPolicy}
          running={running}
          onNewThread={() => { void runThreadAction(async () => {
            await createThread();
            setInspectorOpen(false);
          }); }}
        />
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
          presentation={presentation}
          showToolActivity={settings.agent.showToolActivity}
          onRetry={retryPrompt ? () => void submit(retryPrompt, retryTurnId) : undefined}
          onApprovalDecision={runtime.resolveApproval ? (itemId, approved) => void resolveApproval(itemId, approved) : undefined}
        />
        <AgentComposer
          disabled={activationState !== "ready" || !binding}
          running={running}
          steeringAvailable={state.capabilities.steering}
          retryAvailable={Boolean(retryPrompt)}
          models={modelOptions}
          selectedModel={selectedModel}
          reasoningEffort="standard"
          onModelChange={setSelectedModel}
          onRetry={() => { if (retryPrompt) void submit(retryPrompt, retryTurnId); }}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
