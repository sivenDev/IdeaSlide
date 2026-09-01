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
import { createDirectApplyToolExecutor } from "../lib/agent/agentToolHost";
import { discoverAgentSkills } from "../lib/agent/agentClient";
import { promptFromAssistantUiMessage, toAssistantUiMessage } from "../lib/agent/assistantUiAdapter";
import type { ActiveAgentEditorBinding, AgentToolExecutor } from "../lib/agent/types";
import { createAgentEventId } from "../lib/agent/protocol";
import { NEW_AGENT_THREAD_TITLE } from "../lib/agent/agentThreadTitle.ts";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentConversationSelector } from "./agent/AgentConversationSelector";
import { AgentRuntimeInspector } from "./agent/AgentRuntimeInspector";
import { AgentThreadHeader } from "./agent/AgentThreadHeader";
import { AgentTranscript } from "./agent/AgentTranscript";

export function AgentPanel({
  binding,
  workspace,
  onOpenSettings,
  onClose,
}: {
  binding?: ActiveAgentEditorBinding;
  workspace?: { name: string };
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
  const bindingSkillId = binding?.skillId;
  const welcome = binding
    ? `I can inspect and edit **${binding.document.displayName}**. Editor changes use native Undo and Redo when the active editor supports them.`
    : workspace
      ? `I can inspect and safely update text files in **${workspace.name}** through structured Workspace Tools.`
      : "Open a supported file or Workspace to give the Agent context.";
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
    prepareThreadTitle,
    resumeThread,
    renameThread,
    deleteThread,
    loadMoreHistory,
  } = useAgentThread({
    title: NEW_AGENT_THREAD_TITLE,
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
    const capturedBinding = binding?.document.model ? binding : undefined;
    if ((!capturedBinding && !workspace) || activationState !== "ready" || running) return;
    await prepareThreadTitle(prompt);
    const capturedDocument = capturedBinding?.document;
    const turnId = crypto.randomUUID();
    let turnOpen = true;
    const toolExecutor: AgentToolExecutor = capturedBinding && capturedDocument
      ? createDirectApplyToolExecutor({
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
        })
      : {
          async execute(call) {
            return {
              kind: "failure",
              callId: call.callId,
              name: call.name,
              success: false,
              summary: "No active editor is available for this Tool.",
              error: {
                code: "toolExecutionFailed",
                message: "This Workspace-only Turn cannot execute editor Tools.",
                recovery: "Use the structured Workspace Tools or open a supported document.",
                diagnosticId: crypto.randomUUID(),
                retryable: false,
              },
              truncated: false,
              persistable: true,
            };
          },
          cancel() {},
        };
    const turnBinding = capturedBinding && capturedDocument
      ? {
          documentId: capturedDocument.id,
          documentName: capturedDocument.displayName ?? "Untitled",
          extensionId: capturedBinding.extensionId,
          fileType: capturedBinding.fileType,
          skillId: capturedBinding.skillId,
          revision: capturedDocument.revision,
          sourceModified: capturedDocument.sourceModified,
        }
      : {
          documentId: `workspace:${workspace?.name ?? "active"}`,
          documentName: workspace?.name ?? "Workspace",
          extensionId: "workspace",
          fileType: "workspace",
          revision: 0,
        };
    let failure: unknown;
    try {
      await runtime.startTurn({
        threadId: state.thread.id,
        turnId,
        retryOfTurnId,
        upstreamThreadId: state.runtime.upstreamThreadId,
        upstreamToolSignature: state.runtime.upstreamToolSignature,
        prompt,
        binding: turnBinding,
        baseUrl: settings.ai.baseUrl,
        model: selectedModel,
        availableModels: modelOptions,
        reasoningEffort: "standard",
        systemPrompt: settings.ai.systemPrompt,
        retry: settings.ai.retry,
        policy: agentPolicy,
        selectedSkillIds: [],
        context: capturedBinding?.buildContext() ?? { workspace: { name: workspace?.name } },
        tools: capturedBinding?.tools ?? [],
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
              onResume={resumeThread}
              onRename={renameThread}
              onDelete={deleteThread}
              onLoadMore={loadMoreHistory}
            />
          )}
          running={running}
          onNewThread={() => { void runThreadAction(createThread); }}
          onOpenInspector={() => setInspectorOpen(true)}
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
          disabled={activationState !== "ready" || (!binding && !workspace)}
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
