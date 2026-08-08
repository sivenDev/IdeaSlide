import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  agentMessagesFromState,
  createAgentThreadState,
  reduceAgentEvent,
  removeAgentNotice,
  retryPromptFromState,
  retryTurnIdFromState,
  totalAgentItemCount,
  upsertAgentNotice,
} from "../lib/agent/agentStore";
import type { AgentCapabilities, AgentEvent, AgentItem, AgentThreadState } from "../lib/agent/protocol";

function freshThreadId(): string {
  return crypto.randomUUID();
}

export function useAgentThread({
  bindingKey,
  title,
  welcome,
  capabilities,
}: {
  bindingKey: string;
  title: string;
  welcome: string;
  capabilities: AgentCapabilities;
}) {
  const createState = useCallback(() => createAgentThreadState({
    threadId: freshThreadId(),
    title,
    welcome,
    capabilities,
  }), [capabilities, title, welcome]);
  const [state, setState] = useState<AgentThreadState>(createState);
  const queuedEventsRef = useRef<AgentEvent[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const flushQueuedEvents = useCallback(() => {
    animationFrameRef.current = undefined;
    const events = queuedEventsRef.current.splice(0);
    if (events.length > 0) {
      setState((current) => events.reduce(reduceAgentEvent, current));
    }
  }, []);

  useEffect(() => {
    if (animationFrameRef.current !== undefined) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    queuedEventsRef.current = [];
    setState(createState());
    return () => {
      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      queuedEventsRef.current = [];
    };
  }, [bindingKey, createState]);

  const emit = useCallback((event: AgentEvent) => {
    queuedEventsRef.current.push(event);
    if (event.type !== "itemDelta") {
      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      flushQueuedEvents();
      return;
    }
    if (animationFrameRef.current === undefined) {
      animationFrameRef.current = window.requestAnimationFrame(flushQueuedEvents);
    }
  }, [flushQueuedEvents]);

  const setNotice = useCallback((item: AgentItem) => {
    setState((current) => upsertAgentNotice(current, item));
  }, []);

  const removeNotice = useCallback((itemId: string) => {
    setState((current) => removeAgentNotice(current, itemId));
  }, []);

  const messages = useMemo(() => agentMessagesFromState(state), [state]);
  const retryPrompt = useMemo(() => retryPromptFromState(state), [state]);
  const retryTurnId = useMemo(() => retryTurnIdFromState(state), [state]);
  const itemCount = useMemo(() => totalAgentItemCount(state), [state]);

  return {
    state,
    emit,
    setNotice,
    removeNotice,
    messages,
    retryPrompt,
    retryTurnId,
    itemCount,
  };
}
