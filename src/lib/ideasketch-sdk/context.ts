import {
  sdkRejected,
  sdkSucceeded,
  type IdeaSketchContextNamespace,
  type IdeaSketchSdkCapabilities,
  type IdeaSketchSdkContext,
  type SdkProtocolVersion,
} from "./types.ts";

export interface IdeaSketchContextSource {
  documentId: string;
  activePageId: string;
  documentStatus: IdeaSketchSdkContext["documentStatus"];
  readOnly: boolean;
  mountedPageId?: string;
  revision: number;
  pageEditVersion: number;
  nativeInteraction: { busy: boolean };
}

export function createContextNamespace(input: {
  isActive: () => boolean;
  getSource: () => IdeaSketchContextSource | undefined;
  getCapabilities: () => IdeaSketchSdkCapabilities;
  sdkProtocolVersion: Readonly<SdkProtocolVersion>;
  agentToolProtocolVersion?: Readonly<SdkProtocolVersion>;
  toolSchemaDigest?: string;
  documentFormatVersion: string;
}): IdeaSketchContextNamespace {
  return {
    async get() {
      try {
        if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
        const capabilities = input.getCapabilities();
        if (!capabilities.scopes.includes("context.read")) {
          return sdkRejected("capability_denied", "The caller cannot read the active editor context.");
        }
        const source = input.getSource();
        if (!source) return sdkRejected("editor_unavailable", "The active IdeaSketch editor is unavailable.", true);
        return sdkSucceeded({
          documentRef: `document:${source.documentId}`,
          activePageRef: `page:${source.activePageId}`,
          documentStatus: source.documentStatus,
          writable: capabilities.available.writable && !source.readOnly && source.documentStatus === "editable",
          mounted: source.mountedPageId === source.activePageId,
          busy: source.nativeInteraction.busy,
          revision: source.revision,
          pageEditVersion: source.pageEditVersion,
          sdkProtocolVersion: input.sdkProtocolVersion,
          ...(input.agentToolProtocolVersion ? { agentToolProtocolVersion: input.agentToolProtocolVersion } : {}),
          ...(input.toolSchemaDigest ? { toolSchemaDigest: input.toolSchemaDigest } : {}),
          documentFormatVersion: input.documentFormatVersion,
        } as IdeaSketchSdkContext);
      } catch {
        return sdkRejected("internal_error", "The active editor context could not be read safely.", true);
      }
    },
    async getCapabilities() {
      try {
        if (!input.isActive()) return sdkRejected("session_closed", "The IdeaSketch SDK session is closed.");
        return sdkSucceeded(input.getCapabilities());
      } catch {
        return sdkRejected("internal_error", "The IdeaSketch capabilities could not be read safely.", true);
      }
    },
  };
}
