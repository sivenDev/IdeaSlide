import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  archiveAgentThread,
  deleteAgentThread,
  getAgentThread,
  listAgentThreads,
  renameAgentThread,
  saveAgentThread,
} from "../lib/agent/agentClient";
import {
  agentMessagesFromState,
  agentRuntimeMessagesFromState,
  createAgentThreadState,
  hydrateAgentThreadState,
  prepareAgentThreadTitleState,
  reconcileSettledAgentTurn,
  reduceAgentEvent,
  removeAgentNotice,
  renameAgentThreadState,
  retryPromptFromState,
  retryTurnIdFromState,
  totalAgentItemCount,
  upsertAgentNotice,
} from "../lib/agent/agentStore";
import type {
  AgentCapabilities,
  AgentEvent,
  AgentItem,
  AgentThreadPage,
  AgentThreadRecord,
  AgentThreadRuntimeMetadata,
  AgentThreadState,
} from "../lib/agent/protocol";
import type { AgentPolicySettings } from "../lib/agent/types";

const EMPTY_HISTORY: AgentThreadPage = {
  threads: [],
  recoveredCorruptEntries: 0,
};

function freshThreadId(): string {
  return crypto.randomUUID();
}

function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function persistenceRecord(
  state: AgentThreadState,
  compatibilityReplayMessageLimit: number,
): AgentThreadRecord {
  const { localReplayTruncatedBeforeTurnId } = agentRuntimeMessagesFromState(
    state,
    compatibilityReplayMessageLimit,
  );
  return {
    schemaVersion: 1,
    thread: state.thread,
    capabilities: { ...state.capabilities, persistence: true },
    runtime: {
      ...state.runtime,
      localReplayTruncatedBeforeTurnId,
      compactedBeforeTurnId: undefined,
    },
    context: { ...state.context, localReplayTruncatedBeforeTurnId },
    runtimeDiagnostics: state.runtimeDiagnostics,
  };
}

export function useAgentThread({
  title,
  welcome,
  capabilities,
  runtime,
  policy,
}: {
  title: string;
  welcome: string;
  capabilities: AgentCapabilities;
  runtime: AgentThreadRuntimeMetadata;
  policy: AgentPolicySettings;
}) {
  const defaultsRef = useRef({ title, welcome, capabilities, runtime, policy });
  defaultsRef.current = { title, welcome, capabilities, runtime, policy };
  const createState = useCallback(() => createAgentThreadState({
    threadId: freshThreadId(),
    title: defaultsRef.current.title,
    welcome: defaultsRef.current.welcome,
    capabilities: { ...defaultsRef.current.capabilities, persistence: true },
    runtime: defaultsRef.current.runtime,
  }), []);
  const [state, setState] = useState<AgentThreadState>(createState);
  const [history, setHistory] = useState<AgentThreadPage>(EMPTY_HISTORY);
  const [historyLoading, setHistoryLoading] = useState(isDesktopRuntime());
  const [showArchivedHistory, setShowArchivedHistory] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string>();
  const hydratedRef = useRef(!isDesktopRuntime());
  const persistTimerRef = useRef<number | undefined>(undefined);
  const queuedEventsRef = useRef<AgentEvent[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const deletedThreadIdsRef = useRef(new Set<string>());
  const showArchivedHistoryRef = useRef(false);

  const flushQueuedEvents = useCallback(() => {
    animationFrameRef.current = undefined;
    const events = queuedEventsRef.current.splice(0);
    if (events.length > 0) {
      setState((current) => events.reduce(reduceAgentEvent, current));
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!isDesktopRuntime()) return;
    const page = await listAgentThreads({ includeArchived: showArchivedHistoryRef.current });
    setHistory(page);
    if (page.recoveredCorruptEntries > 0) {
      setPersistenceError(`${page.recoveredCorruptEntries} corrupt Agent history entr${page.recoveredCorruptEntries === 1 ? "y was" : "ies were"} quarantined.`);
    }
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let active = true;
    setHistoryLoading(true);
    listAgentThreads()
      .then(async (page) => {
        if (!active) return;
        setHistory(page);
        const latest = page.threads[0];
        if (latest) {
          const record = await getAgentThread(latest.id);
          if (active && record) setState(hydrateAgentThreadState(record));
        } else {
          const initial = createState();
          setState(initial);
          await saveAgentThread(persistenceRecord(
            initial,
            defaultsRef.current.policy.compatibilityReplayMessageLimit,
          ));
          if (active) await refreshHistory();
        }
        if (page.recoveredCorruptEntries > 0 && active) {
          setPersistenceError(`${page.recoveredCorruptEntries} corrupt Agent history entr${page.recoveredCorruptEntries === 1 ? "y was" : "ies were"} quarantined.`);
        }
      })
      .catch((cause) => {
        if (active) setPersistenceError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) {
          hydratedRef.current = true;
          setHistoryLoading(false);
        }
      });
    return () => {
      active = false;
      hydratedRef.current = false;
    };
  }, [createState, refreshHistory]);

  useEffect(() => {
    if (!hydratedRef.current || !isDesktopRuntime() || state.activeTurnId) return;
    if (persistTimerRef.current !== undefined) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = undefined;
      if (deletedThreadIdsRef.current.has(state.thread.id)) return;
      saveAgentThread(persistenceRecord(
        state,
        defaultsRef.current.policy.compatibilityReplayMessageLimit,
      ))
        .then(() => refreshHistory())
        .catch((cause) => setPersistenceError(cause instanceof Error ? cause.message : String(cause)));
    }, 150);
    return () => {
      if (persistTimerRef.current !== undefined) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = undefined;
      }
    };
  }, [refreshHistory, state]);

  useEffect(() => () => {
    if (animationFrameRef.current !== undefined) window.cancelAnimationFrame(animationFrameRef.current);
    if (persistTimerRef.current !== undefined) window.clearTimeout(persistTimerRef.current);
    queuedEventsRef.current = [];
  }, []);

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

  const settleTurn = useCallback((
    turnId: string,
    outcome: "failed" | "cancelled",
    error?: Parameters<typeof reconcileSettledAgentTurn>[3],
  ) => {
    setState((current) => reconcileSettledAgentTurn(current, turnId, outcome, error));
  }, []);

  const createThread = useCallback(async () => {
    const next = createState();
    setState(next);
    setPersistenceError(undefined);
    if (isDesktopRuntime()) {
      await saveAgentThread(persistenceRecord(
        next,
        defaultsRef.current.policy.compatibilityReplayMessageLimit,
      ));
      await refreshHistory();
    }
  }, [createState, refreshHistory]);

  const resumeThread = useCallback(async (threadId: string) => {
    if (!isDesktopRuntime()) return;
    const record = await getAgentThread(threadId);
    if (!record) throw new Error("Agent Thread was not found.");
    queuedEventsRef.current = [];
    setState(hydrateAgentThreadState(record));
    setPersistenceError(undefined);
  }, []);

  const renameThread = useCallback(async (threadId: string, nextTitle: string) => {
    const titleValue = nextTitle.trim();
    if (!titleValue) return;
    if (isDesktopRuntime()) await renameAgentThread(threadId, titleValue);
    setState((current) => current.thread.id === threadId
      ? renameAgentThreadState(current, titleValue)
      : current);
    await refreshHistory();
  }, [refreshHistory]);

  const prepareThreadTitle = useCallback(async (prompt: string) => {
    const next = prepareAgentThreadTitleState(state, prompt);
    if (next === state) return;
    setState(next);
    if (!isDesktopRuntime()) return;
    try {
      await saveAgentThread(persistenceRecord(
        next,
        defaultsRef.current.policy.compatibilityReplayMessageLimit,
      ));
      await refreshHistory();
    } catch (cause) {
      setPersistenceError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [refreshHistory, state]);

  const archiveThread = useCallback(async (threadId: string) => {
    if (isDesktopRuntime()) await archiveAgentThread(threadId);
    if (state.thread.id === threadId) await createThread();
    else await refreshHistory();
  }, [createThread, refreshHistory, state.thread.id]);

  const deleteThread = useCallback(async (threadId: string) => {
    if (state.activeTurnId) {
      throw new Error("Stop the running Turn before deleting its Thread.");
    }
    if (!isDesktopRuntime()) return;

    const deletingCurrent = state.thread.id === threadId;
    let replacement: AgentThreadState | undefined;
    if (deletingCurrent) {
      deletedThreadIdsRef.current.add(threadId);
      queuedEventsRef.current = [];
      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      if (persistTimerRef.current !== undefined) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = undefined;
      }
      replacement = createState();
      setState(replacement);
      try {
        await saveAgentThread(persistenceRecord(
          replacement,
          defaultsRef.current.policy.compatibilityReplayMessageLimit,
        ));
      } catch (cause) {
        deletedThreadIdsRef.current.delete(threadId);
        setState(state);
        throw cause;
      }
    }

    try {
      await deleteAgentThread(threadId);
    } catch (cause) {
      deletedThreadIdsRef.current.delete(threadId);
      throw cause;
    }
    setPersistenceError(undefined);
    await refreshHistory();
  }, [createState, refreshHistory, state.activeTurnId, state.thread.id]);

  const setArchivedHistoryVisible = useCallback(async (visible: boolean) => {
    if (!isDesktopRuntime()) return;
    setHistoryLoading(true);
    try {
      const page = await listAgentThreads({ includeArchived: visible });
      showArchivedHistoryRef.current = visible;
      setShowArchivedHistory(visible);
      setHistory(page);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadMoreHistory = useCallback(async () => {
    if (!isDesktopRuntime() || !history.nextCursor) return;
    setHistoryLoading(true);
    try {
      const page = await listAgentThreads({
        cursor: history.nextCursor,
        includeArchived: showArchivedHistory,
      });
      setHistory((current) => ({
        threads: [...current.threads, ...page.threads],
        nextCursor: page.nextCursor,
        recoveredCorruptEntries: current.recoveredCorruptEntries + page.recoveredCorruptEntries,
      }));
    } finally {
      setHistoryLoading(false);
    }
  }, [history.nextCursor, showArchivedHistory]);

  const messages = useMemo(() => agentMessagesFromState(state), [state]);
  const runtimeMessages = useMemo(() => agentRuntimeMessagesFromState(
    state,
    policy.compatibilityReplayMessageLimit,
  ).messages, [policy.compatibilityReplayMessageLimit, state]);
  const retryPrompt = useMemo(() => retryPromptFromState(state), [state]);
  const retryTurnId = useMemo(() => retryTurnIdFromState(state), [state]);
  const itemCount = useMemo(() => totalAgentItemCount(state), [state]);

  return {
    state,
    emit,
    setNotice,
    removeNotice,
    settleTurn,
    messages,
    runtimeMessages,
    retryPrompt,
    retryTurnId,
    itemCount,
    history,
    historyLoading,
    showArchivedHistory,
    persistenceError,
    createThread,
    prepareThreadTitle,
    resumeThread,
    renameThread,
    archiveThread,
    deleteThread,
    setArchivedHistoryVisible,
    loadMoreHistory,
  };
}
