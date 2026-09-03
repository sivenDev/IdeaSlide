import {
  sdkRejected,
  sdkSucceeded,
  type DocumentRef,
  type IdeaSketchSdkEvent,
  type IdeaSketchSdkEventHandler,
  type IdeaSketchEventsNamespace,
  type IdeaSketchSdkUnsubscribe,
  type SdkSyncResult,
} from "./types.ts";

type EventType = IdeaSketchSdkEvent["type"];
type EventWithoutEnvelope = IdeaSketchSdkEvent extends infer Event
  ? Event extends IdeaSketchSdkEvent
    ? Omit<Event, "sequence" | "documentRef">
    : never
  : never;

export interface IdeaSketchEventDispatcher {
  subscribe<Event extends IdeaSketchSdkEvent>(
    type: Event["type"],
    handler: IdeaSketchSdkEventHandler<Event>,
  ): SdkSyncResult<IdeaSketchSdkUnsubscribe>;
  dispatch(event: EventWithoutEnvelope): void;
  dispatchBatch(events: readonly EventWithoutEnvelope[]): void;
  dispose(): void;
}

export interface IdeaSketchEventHub {
  createDispatcher(): IdeaSketchEventDispatcher;
  publish(event: EventWithoutEnvelope): void;
  publishBatch(events: readonly EventWithoutEnvelope[]): void;
  dispose(): void;
}

/** Binds the generic dispatcher to the public, named event methods exposed by
 * the facade. Capability/session checks remain at the host boundary; this
 * adapter only maps each method to its canonical event type. */
export function createIdeaSketchEventsNamespace(
  dispatcher: IdeaSketchEventDispatcher,
  options: { isActive?: () => boolean } = {},
): IdeaSketchEventsNamespace {
  const subscribe = <Event extends IdeaSketchSdkEvent>(
    type: Event["type"],
    handler: IdeaSketchSdkEventHandler<Event>,
  ) => {
    if (options.isActive && !options.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
    return dispatcher.subscribe(type, handler);
  };
  return {
    onContextChange: (handler) => subscribe("context-change", handler),
    onDocumentCommitted: (handler) => subscribe("document-committed", handler),
    onSceneCommitted: (handler) => subscribe("scene-committed", handler),
    onSelectionChange: (handler) => subscribe("selection-change", handler),
    onAvailabilityChange: (handler) => subscribe("availability-change", handler),
    onPresentationStateChange: (handler) => subscribe("presentation-state-change", handler),
  };
}

interface Subscription {
  type: EventType;
  handler: IdeaSketchSdkEventHandler<IdeaSketchSdkEvent>;
  active: boolean;
}

function freezeEvent(event: IdeaSketchEventDispatcherInput, sequence: number, documentRef: DocumentRef): IdeaSketchSdkEvent {
  const clone: Record<string, unknown> = { ...event, sequence, documentRef };
  for (const key of ["operationKinds", "createdPageRefs", "updatedPageRefs", "deletedPageRefs", "affectedRefs", "refs"] as const) {
    const value = clone[key];
    if (Array.isArray(value)) clone[key] = Object.freeze([...value]);
  }
  return Object.freeze(clone) as unknown as IdeaSketchSdkEvent;
}

type IdeaSketchEventDispatcherInput = EventWithoutEnvelope;

function validEventType(value: unknown): value is EventType {
  return value === "context-change"
    || value === "document-committed"
    || value === "scene-committed"
    || value === "selection-change"
    || value === "availability-change"
    || value === "presentation-state-change";
}

function validEventInput(value: unknown): value is IdeaSketchEventDispatcherInput {
  try {
    return typeof value === "object" && value !== null && validEventType((value as { type?: unknown }).type);
  } catch {
    return false;
  }
}

export function createIdeaSketchEventDispatcher(input: {
  documentRef: DocumentRef;
}): IdeaSketchEventDispatcher {
  const subscriptions = new Set<Subscription>();
  const pending: IdeaSketchEventDispatcherInput[][] = [];
  let sequence = 0;
  let dispatching = false;
  let disposed = false;

  const runBatch = (events: readonly IdeaSketchEventDispatcherInput[]) => {
    if (disposed || events.length === 0) return;
    const frozenEvents = events
      .filter(validEventInput)
      .map((event) => freezeEvent(event, ++sequence, input.documentRef));
    // Freeze the subscriber collection for the entire batch.  This is the
    // reentrancy boundary: subscribe/unsubscribe from a callback only affects
    // the next batch, never the currently running event sequence.
    const batchSubscriptions = [...subscriptions].filter((subscription) => subscription.active);
    for (const event of frozenEvents) {
      for (const subscription of batchSubscriptions) {
        if (subscription.type !== event.type) continue;
        try {
          subscription.handler(event);
        } catch {
          // Subscriber failures are intentionally isolated from the event
          // source and from other subscribers.
        }
      }
    }
  };

  const drain = () => {
    if (dispatching || disposed) return;
    dispatching = true;
    try {
      while (pending.length > 0 && !disposed) {
        const batch = pending.shift();
        if (batch) runBatch(batch);
      }
    } finally {
      dispatching = false;
    }
  };

  return {
    subscribe<Event extends IdeaSketchSdkEvent>(type: Event["type"], handler: IdeaSketchSdkEventHandler<Event>) {
      if (disposed) return sdkRejected("session_closed", "The IdeaSketch event dispatcher is closed.");
      if (!validEventType(type) || typeof handler !== "function") return sdkRejected("invalid_request", "An event type and handler are required.");
      const subscription: Subscription = {
        type,
        handler: handler as IdeaSketchSdkEventHandler<IdeaSketchSdkEvent>,
        active: true,
      };
      subscriptions.add(subscription);
      const unsubscribe = () => {
        if (!subscription.active) return;
        subscription.active = false;
        subscriptions.delete(subscription);
      };
      return sdkSucceeded(unsubscribe);
    },
    dispatch(event: IdeaSketchEventDispatcherInput) {
      if (disposed || !validEventInput(event)) return;
      pending.push([event]);
      drain();
    },
    dispatchBatch(events: readonly IdeaSketchEventDispatcherInput[]) {
      if (disposed || !Array.isArray(events) || events.length === 0) return;
      pending.push(events.filter(validEventInput));
      drain();
    },
    dispose() {
      disposed = true;
      pending.length = 0;
      for (const subscription of subscriptions) subscription.active = false;
      subscriptions.clear();
    },
  };
}

export function createIdeaSketchEventHub(input: { documentRef: DocumentRef }): IdeaSketchEventHub {
  const dispatchers = new Set<IdeaSketchEventDispatcher>();
  let disposed = false;
  const createDispatcher = () => {
    if (disposed) {
      const closed = createIdeaSketchEventDispatcher(input);
      closed.dispose();
      return closed;
    }
    const dispatcher = createIdeaSketchEventDispatcher(input);
    dispatchers.add(dispatcher);
    return dispatcher;
  };
  return {
    createDispatcher,
    publish(event) {
      if (disposed) return;
      for (const dispatcher of [...dispatchers]) dispatcher.dispatch(event);
    },
    publishBatch(events) {
      if (disposed || !Array.isArray(events) || events.length === 0) return;
      for (const dispatcher of [...dispatchers]) dispatcher.dispatchBatch(events);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const dispatcher of dispatchers) dispatcher.dispose();
      dispatchers.clear();
    },
  };
}
