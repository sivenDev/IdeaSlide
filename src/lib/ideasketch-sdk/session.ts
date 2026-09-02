import {
  sdkRejected,
  sdkSucceeded,
  type CallerSessionId,
  type IdeaSketchSdkCallerProfile,
  type IdeaSketchSdkEvent,
  type IdeaSketchSdkEventHandler,
  type IdeaSketchSdkSessionInfo,
  type IdeaSketchSdkUnsubscribe,
  type IdeaSketchSessionNamespace,
  type SdkProtocolVersion,
  type SdkSyncResult,
} from "./types.ts";
import type { IdeaSketchRequestLedger } from "./requestLedger.ts";

type IdeaSketchSdkEventType = IdeaSketchSdkEvent["type"];

interface SessionSubscription {
  type: IdeaSketchSdkEventType;
  handler: IdeaSketchSdkEventHandler<IdeaSketchSdkEvent>;
  active: boolean;
}

export interface IdeaSketchSessionController {
  namespace: IdeaSketchSessionNamespace;
  isActive: () => boolean;
  isDisposed: () => boolean;
  subscribe: (
    type: IdeaSketchSdkEventType,
    handler: IdeaSketchSdkEventHandler<IdeaSketchSdkEvent>,
  ) => SdkSyncResult<IdeaSketchSdkUnsubscribe>;
}

export function createSessionController(input: {
  sessionId: CallerSessionId;
  callerProfile: IdeaSketchSdkCallerProfile;
  sdkProtocolVersion: Readonly<SdkProtocolVersion>;
  agentToolProtocolVersion?: Readonly<SdkProtocolVersion>;
  toolSchemaDigest?: string;
  documentFormatVersion: string;
  ledger: IdeaSketchRequestLedger;
  cleanupSession?: () => Promise<void>;
  invalidateCallerResources: () => void;
  onDisposed?: () => void;
}): IdeaSketchSessionController {
  let lifecycle: IdeaSketchSdkSessionInfo["lifecycle"] = "active";
  let disposing = false;
  let disposal: Promise<Awaited<ReturnType<IdeaSketchSessionNamespace["dispose"]>>> | undefined;
  const subscriptions = new Set<SessionSubscription>();

  const getInfo = (): IdeaSketchSdkSessionInfo => ({
    sessionId: input.sessionId,
    callerProfile: input.callerProfile,
    sdkProtocolVersion: input.sdkProtocolVersion,
    ...(input.agentToolProtocolVersion
      ? { agentToolProtocolVersion: input.agentToolProtocolVersion }
      : {}),
    ...(input.toolSchemaDigest ? { toolSchemaDigest: input.toolSchemaDigest } : {}),
    documentFormatVersion: input.documentFormatVersion,
    lifecycle,
  });

  const clearSubscriptions = () => {
    for (const subscription of subscriptions) subscription.active = false;
    subscriptions.clear();
  };

  const namespace: IdeaSketchSessionNamespace = {
    async getInfo() {
      return sdkSucceeded(getInfo());
    },
    async dispose() {
      if (lifecycle === "disposed") return sdkSucceeded({ outcome: "noop" as const });
      if (disposal) return disposal;
      if (input.ledger.hasHostInteractionInFlight() && !input.cleanupSession) {
        return sdkRejected(
          "editor_busy",
          "The active host interaction cannot be cancelled safely.",
          true,
        );
      }
      const disposalReservation = input.ledger.beginDisposal();
      if (disposalReservation.status === "rejected") return disposalReservation;

      disposal = (async () => {
        disposing = true;
        try {
          await input.cleanupSession?.();
        } catch {
          input.ledger.cancelDisposal(disposalReservation.value);
          disposing = false;
          return sdkRejected("internal_error", "The IdeaSketch SDK session could not be cleaned up.", true);
        }

        const hostInteractionsClosed = input.ledger.terminalizeHostInteractionsForDisposal(
          disposalReservation.value,
        );
        if (hostInteractionsClosed.status === "rejected") {
          input.ledger.cancelDisposal(disposalReservation.value);
          disposing = false;
          return sdkRejected(
            "internal_error",
            "The IdeaSketch SDK host interactions could not be closed safely.",
            true,
          );
        }

        try {
          input.invalidateCallerResources();
        } catch {
          input.ledger.cancelDisposal(disposalReservation.value);
          disposing = false;
          return sdkRejected(
            "internal_error",
            "The IdeaSketch SDK caller resources could not be invalidated.",
            true,
          );
        }
        clearSubscriptions();
        const ledgerDisposed = input.ledger.finishDisposal(disposalReservation.value);
        if (ledgerDisposed.status === "rejected") {
          lifecycle = "disposed";
          disposing = false;
          try {
            input.onDisposed?.();
          } catch {
            // Session registry cleanup cannot reopen an already closed facade.
          }
          return sdkRejected("internal_error", "The IdeaSketch SDK request ledger could not be closed.");
        }
        lifecycle = "disposed";
        disposing = false;
        try {
          input.onDisposed?.();
        } catch {
          // Session registry cleanup cannot reopen an already closed facade.
        }
        return sdkSucceeded({ outcome: "disposed" as const });
      })();

      try {
        return await disposal;
      } finally {
        disposal = undefined;
      }
    },
  };

  return {
    namespace,
    isActive: () => lifecycle === "active" && !disposing,
    isDisposed: () => lifecycle === "disposed",
    subscribe(type, handler) {
      if (lifecycle !== "active" || disposing) {
        return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
      }
      if (typeof handler !== "function") {
        return sdkRejected("invalid_request", "An event handler is required.");
      }
      const subscription: SessionSubscription = {
        type,
        handler,
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
  };
}
