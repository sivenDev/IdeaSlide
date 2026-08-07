import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { Bot, Settings2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DocumentModel, DocumentSession } from "../types";
import { useSettings } from "../hooks/useSettings";
import { cancelAgent, discoverAgentSkills, runAgent } from "../lib/agent/agentClient";
import { markAgentChangeSetApplied, markAgentChangeSetStale, rejectAgentChangeSet } from "../lib/agent/changeSet";
import { promptFromAssistantUiMessage, toAssistantUiMessage } from "../lib/agent/assistantUiAdapter";
import type { AgentChangeSet, AgentExtension, AgentMessage } from "../lib/agent/types";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentToolActivity } from "./agent/AgentToolActivity";
import { IdeaSketchChangeReview } from "./agent/IdeaSketchChangeReview";
import type { IdeaSketchAgentOperation } from "../lib/agent/extensions/ideaSketchAgentExtension";

function visibleResponse(text: string): string {
  return text.replace(/```ideanote-change[\s\S]*?```/gi, "").trim();
}

function UserAgentMessage() {
  return (
    <MessagePrimitive.Root className="ideanote-agent-message is-user">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

function AssistantAgentMessage() {
  return (
    <MessagePrimitive.Root className="ideanote-agent-message is-assistant">
      <Sparkles aria-hidden size={13} />
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

export function AgentPanel<TModel extends DocumentModel>({
  document,
  activePageId,
  extension,
  readOnly,
  onOpenSettings,
  onApplyChangeSet,
  onUndo,
  canUndo,
}: {
  document: DocumentSession<TModel>;
  activePageId?: string;
  extension: AgentExtension<TModel>;
  readOnly: boolean;
  onOpenSettings: () => void;
  onApplyChangeSet: (changeSet: AgentChangeSet) => boolean;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const { settings, activationState } = useSettings();
  const [messages, setMessages] = useState<AgentMessage[]>([
    { id: "welcome", role: "assistant", content: "I can inspect the active IdeaSketch file and prepare reviewable changes.", createdAt: Date.now() },
  ]);
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState<string>();
  const [error, setError] = useState<string>();
  const [changeSet, setChangeSet] = useState<AgentChangeSet>();
  const runGeneration = useRef(0);
  const activeRunId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (activationState !== "ready") return;
    let active = true;
    discoverAgentSkills()
      .then((skills) => {
        if (active && !skills.some((skill) => skill.id === extension.skillId)) {
          setError(`The ${extension.skillId} Skill is not installed.`);
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [activationState, extension.skillId]);

  const submit = async (prompt: string) => {
    if (!document.model || activationState !== "ready") return;
    const generation = ++runGeneration.current;
    const runId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    activeRunId.current = runId;
    const userMessage: AgentMessage = { id: crypto.randomUUID(), role: "user", content: prompt, createdAt: Date.now() };
    const previousMessages = messages;
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "", createdAt: Date.now() },
    ]);
    setRunning(true);
    setError(undefined);
    setActivity(`Loaded ${extension.skillId} Skill and ${extension.tools.length} editor Tools`);
    try {
      let streamedText = "";
      const response = await runAgent({
        runId,
        prompt,
        baseUrl: settings.ai.baseUrl,
        model: settings.ai.model,
        systemPrompt: settings.ai.systemPrompt,
        skillId: extension.skillId,
        context: extension.buildContext(document.model, activePageId, document.revision),
        tools: extension.tools,
        messages: previousMessages.map(({ role, content }) => ({ role, content })),
      }, (event) => {
        if (generation !== runGeneration.current || event.runId !== runId) return;
        if (event.type === "textDelta") {
          streamedText += event.text;
          const content = visibleResponse(streamedText);
          setMessages((current) => current.map((message) => (
            message.id === assistantMessageId ? { ...message, content } : message
          )));
        }
      });
      if (generation !== runGeneration.current) return;
      const content = visibleResponse(response.text) || "I prepared a change proposal for review.";
      setMessages((current) => current.map((message) => (
        message.id === assistantMessageId ? { ...message, content } : message
      )));
      const proposal = extension.parseChangeSet(response.text, document.id, document.revision, document.model);
      if (proposal) {
        setChangeSet({
          ...proposal,
          baseDocumentStatus: document.status,
          baseSourceModified: document.sourceModified,
        });
        setActivity("Mutation Tool produced a proposal; no file was written");
      } else {
        setActivity("Agent run completed");
      }
    } catch (cause) {
      if (generation === runGeneration.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (activeRunId.current === runId) activeRunId.current = undefined;
      if (generation === runGeneration.current) setRunning(false);
    }
  };

  const cancel = () => {
    const runId = activeRunId.current;
    runGeneration.current += 1;
    activeRunId.current = undefined;
    setRunning(false);
    setActivity("Cancelling Agent run…");
    if (runId) {
      cancelAgent(runId)
        .then((cancelled) => setActivity(cancelled ? "Agent run cancelled" : "Agent run already completed"))
        .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    }
  };

  const approve = () => {
    if (!changeSet) return;
    if (
      readOnly
      || document.status !== "editable"
      || document.revision !== changeSet.baseRevision
      || changeSet.baseDocumentStatus !== document.status
      || changeSet.baseSourceModified !== document.sourceModified
    ) {
      setChangeSet(markAgentChangeSetStale(changeSet));
      return;
    }
    if (onApplyChangeSet(changeSet)) setChangeSet(markAgentChangeSetApplied(changeSet));
    else setChangeSet(markAgentChangeSetStale(changeSet));
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
    onCancel: async () => cancel(),
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

  return (
    <AssistantRuntimeProvider runtime={assistantRuntime}>
      <ThreadPrimitive.Root className="ideanote-agent-panel">
        <ThreadPrimitive.Viewport className="ideanote-agent-messages" aria-live="polite">
          <ThreadPrimitive.Messages
            components={{ UserMessage: UserAgentMessage, AssistantMessage: AssistantAgentMessage }}
          />
          {activity && settings.agent.showToolActivity && <AgentToolActivity text={activity} />}
          {changeSet && extension.fileType === "ideasketch" && (
            <IdeaSketchChangeReview
              changeSet={changeSet as AgentChangeSet<IdeaSketchAgentOperation>}
              readOnly={readOnly}
              onApprove={approve}
              onReject={() => setChangeSet(rejectAgentChangeSet(changeSet))}
              onUndo={onUndo}
              canUndo={canUndo}
            />
          )}
          {error && <div className="ideanote-agent-error">{error}</div>}
        </ThreadPrimitive.Viewport>
        <AgentComposer disabled={activationState !== "ready"} running={running} />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
