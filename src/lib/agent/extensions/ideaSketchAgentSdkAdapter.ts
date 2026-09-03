import {
  IDEA_SKETCH_SDK_PROTOCOL_VERSION,
} from "../../ideasketch-sdk/capabilities.ts";
import {
  createIdeaSketchHostCaller,
  getActiveIdeaSketchSdkHost,
} from "../../ideasketch-sdk/host.ts";
import type {
  IdeaSketchOperation,
  IdeaSketchSdk,
  IdeaSketchSdkContext,
  IdeaSketchSdkMutationResult,
  IdeaSketchTextContent,
  SdkResult,
  SdkSyncResult,
} from "../../ideasketch-sdk/types.ts";
import type {
  AgentChangeSet,
  AgentToolCall,
  AgentToolExecutor,
  AgentToolFailureResult,
  AgentToolMutationResult,
  AgentToolReadResult,
} from "../types.ts";
import {
  AGENT_TOOL_SCHEMA_DIGESTS,
  getIdeaSketchAgentToolProtocol,
  type AgentToolProtocolBinding,
} from "../agentToolProtocol.ts";

type AdapterErrorCode = "toolValidationFailed" | "toolExecutionFailed";
const LEGACY_V1_SCENE_READ_LIMIT = 80;

class AdapterError extends Error {
  readonly code: AdapterErrorCode;

  constructor(message: string, code: AdapterErrorCode = "toolExecutionFailed") {
    super(message);
    this.name = "AdapterError";
    this.code = code;
  }
}

function failure(call: AgentToolCall, message: string, code: AdapterErrorCode): AgentToolFailureResult {
  return {
    kind: "failure",
    callId: call.callId,
    name: call.name,
    success: false,
    summary: message,
    error: {
      code,
      message,
      recovery: code === "toolValidationFailed"
        ? "Retry with arguments that match the negotiated IdeaSketch Tool schema."
        : "Retry the Tool after refreshing the IdeaSketch editor context.",
      diagnosticId: crypto.randomUUID(),
      retryable: code === "toolExecutionFailed",
    },
    truncated: false,
    persistable: true,
  };
}

function resultError(result: SdkResult<unknown>): AdapterError {
  if (result.status === "succeeded") return new AdapterError("The SDK returned an invalid result.");
  const code: AdapterErrorCode = result.error.code === "invalid_request"
    || result.error.code === "unsupported_operation"
    || result.error.code === "capability_denied"
    || result.error.code === "snapshot_required"
    || result.error.code === "incomplete_read"
    || result.error.code === "target_not_found"
    || result.error.code === "cross_page_target"
    || result.error.code === "relation_conflict"
    || result.error.code === "locked_target"
    || result.error.code === "limit_exceeded"
    ? "toolValidationFailed"
    : "toolExecutionFailed";
  return new AdapterError(result.error.message, code);
}

function expectSync<T>(result: SdkSyncResult<T>): T {
  if (result.status !== "succeeded") throw new AdapterError(result.error.message, "toolValidationFailed");
  return result.value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdapterError("Tool arguments must be an object.", "toolValidationFailed");
  }
  return value as Record<string, unknown>;
}

function assertKnownFields(input: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unknown = Reflect.ownKeys(input).filter((key) => typeof key !== "string" || !allowed.includes(key));
  if (unknown.length > 0) {
    throw new AdapterError(`${label} contains unknown field(s): ${unknown.map(String).join(", ")}.`, "toolValidationFailed");
  }
}

function sdkRef(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new AdapterError(`${label} is required.`, "toolValidationFailed");
  if (/^(?:element|camera|page|temp):/.test(value)) return value;
  return `temp:${value}`;
}

function pageRef(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new AdapterError("pageId is required.", "toolValidationFailed");
  return value.startsWith("page:") ? value : `page:${value}`;
}

function textContent(input: Record<string, unknown>): IdeaSketchTextContent {
  const hasText = Object.prototype.hasOwnProperty.call(input, "text");
  const hasOriginal = Object.prototype.hasOwnProperty.call(input, "originalText");
  if (hasText === hasOriginal || (hasText && typeof input.text !== "string") || (hasOriginal && typeof input.originalText !== "string")) {
    throw new AdapterError("Text operations require exactly one string content field: text or originalText.", "toolValidationFailed");
  }
  return hasText ? { text: input.text as string } : { originalText: input.originalText as string };
}

function optionalObject(input: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(input, key)) return undefined;
  const value = input[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdapterError(`${key} must be an object.`, "toolValidationFailed");
  return value as Record<string, unknown>;
}

function boundedReadOptions(input: Record<string, unknown>, kind: "document" | "scene") {
  const options: Record<string, unknown> = {};
  const allowed = kind === "document" ? ["cursor", "limit"] : ["snapshotId", "cursor", "limit"];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new AdapterError(`Unknown ${kind} read option: ${key}`, "toolValidationFailed");
  }
  for (const key of ["cursor", "snapshotId"] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "string" || input[key].length === 0 || /[\u0000-\u0020\u007f]/.test(input[key] as string)) {
        throw new AdapterError(`${key} is malformed.`, "toolValidationFailed");
      }
      options[key] = input[key];
    }
  }
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || (input.limit as number) < 1 || (input.limit as number) > 100) {
      throw new AdapterError("limit must be an integer from 1 to 100.", "toolValidationFailed");
    }
    options.limit = input.limit;
  }
  return options;
}

function shapeStyle(input: Record<string, unknown>) {
  const style = optionalObject(input, "style");
  return style ? { style } : {};
}

function connectorStyle(input: Record<string, unknown>, allowLegacyShapeFields = false) {
  const style = optionalObject(input, "style");
  if (!style) return {};
  // The pinned v1 catalog historically reused the shape style schema for
  // arrows, so it accepted backgroundColor/fillStyle/roundness even though
  // those fields have no connector meaning in the canonical SDK. Keep those
  // legacy inputs accepted for v1 compatibility, but never let them widen the
  // v2 connector contract or leak into the canonical connector operation.
  assertKnownFields(
    style,
    allowLegacyShapeFields
      ? ["strokeColor", "strokeWidth", "strokeStyle", "opacity", "roughness", "backgroundColor", "fillStyle", "roundness"]
      : ["strokeColor", "strokeWidth", "strokeStyle", "opacity", "roughness"],
    "Connector style",
  );
  const output: Record<string, unknown> = {};
  for (const key of ["strokeColor", "strokeWidth", "strokeStyle", "opacity", "roughness"]) {
    if (Object.prototype.hasOwnProperty.call(style, key)) output[key] = style[key];
  }
  return { style: output };
}

function textStyle(input: Record<string, unknown>) {
  const style = optionalObject(input, "style");
  const keys = ["fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"];
  if (style) {
    if (keys.some((key) => Object.prototype.hasOwnProperty.call(input, key))) {
      throw new AdapterError("Text style cannot mix style with top-level style fields.", "toolValidationFailed");
    }
    return { style };
  }
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) output[key] = input[key];
  }
  return output;
}

function textLayout(input: Record<string, unknown>) {
  const layout = optionalObject(input, "layout");
  if (layout) {
    if (Object.prototype.hasOwnProperty.call(input, "autoResize") || Object.prototype.hasOwnProperty.call(input, "width")) {
      throw new AdapterError("Text layout cannot mix layout with top-level layout fields.", "toolValidationFailed");
    }
    return { layout };
  }
  const output: Record<string, unknown> = {};
  for (const key of ["autoResize", "width"]) {
    if (Object.prototype.hasOwnProperty.call(input, key)) output[key] = input[key];
  }
  return output;
}

function operationFromDrawing(sdk: IdeaSketchSdk, raw: unknown, options: { allowLegacyConnectorStyle?: boolean } = {}): IdeaSketchOperation {
  const input = asRecord(raw);
  switch (input.kind) {
    case "create-shape": {
      assertKnownFields(input, ["kind", "ref", "shape", "x", "y", "width", "height", "style"], "create-shape");
      if (typeof input.shape !== "string" || typeof input.x !== "number" || typeof input.y !== "number"
        || typeof input.width !== "number" || typeof input.height !== "number") {
        throw new AdapterError("create-shape requires shape and finite bounds.", "toolValidationFailed");
      }
      return expectSync(sdk.operations.shape.create({
        ref: sdkRef(input.ref, "Shape ref"),
        shape: input.shape,
        bounds: { x: input.x, y: input.y, width: input.width, height: input.height },
        ...shapeStyle(input),
      } as never));
    }
    case "create-arrow": {
      assertKnownFields(input, ["kind", "ref", "start", "end", "style"], "create-arrow");
      const start = asRecord(input.start);
      const end = asRecord(input.end);
      return expectSync(sdk.operations.connector.create({
        ref: sdkRef(input.ref, "Arrow ref"),
        points: [[start.x, start.y], [end.x, end.y]],
        ...connectorStyle(input, options.allowLegacyConnectorStyle),
      } as never));
    }
    case "bind-arrow": {
      assertKnownFields(input, ["kind", "arrowRef", "startElementRef", "endElementRef"], "bind-arrow");
      const output: Record<string, unknown> = { arrowRef: sdkRef(input.arrowRef, "Arrow ref") };
      if (input.startElementRef !== undefined) output.start = { endpoint: "start", targetRef: sdkRef(input.startElementRef, "Arrow start target") };
      if (input.endElementRef !== undefined) output.end = { endpoint: "end", targetRef: sdkRef(input.endElementRef, "Arrow end target") };
      return expectSync(sdk.operations.connector.bind(output as never));
    }
    case "create-text":
      assertKnownFields(input, ["kind", "ref", "x", "y", "text", "originalText", "style", "layout"], "create-text");
      return expectSync(sdk.operations.text.create({
        ref: sdkRef(input.ref, "Text ref"),
        x: input.x,
        y: input.y,
        ...textContent(input),
        ...textStyle(input),
        ...textLayout(input),
      } as never));
    case "bind-text":
      assertKnownFields(input, ["kind", "textRef", "containerRef"], "bind-text");
      return expectSync(sdk.operations.text.bind({
        textRef: sdkRef(input.textRef, "Text ref"),
        containerRef: sdkRef(input.containerRef, "Container ref"),
      } as never));
    case "unbind-text": {
      assertKnownFields(input, ["kind", "textRef", "containerRef"], "unbind-text");
      const output: Record<string, unknown> = {};
      if (input.textRef !== undefined) output.textRef = sdkRef(input.textRef, "Text ref");
      if (input.containerRef !== undefined) output.containerRef = sdkRef(input.containerRef, "Container ref");
      return expectSync(sdk.operations.text.unbind(output as never));
    }
    case "upsert-bound-text": {
      assertKnownFields(input, ["kind", "shapeRef", "createRef", "text", "originalText", "style", "layout"], "upsert-bound-text");
      const output = {
        shapeRef: sdkRef(input.shapeRef, "Shape ref"),
        ...(input.createRef === undefined ? {} : { createRef: sdkRef(input.createRef, "Text create ref") }),
        ...textContent(input),
        ...textStyle(input),
        ...textLayout(input),
      };
      return expectSync(sdk.operations.shape.upsertBoundText(output as never));
    }
    case "set-text":
      assertKnownFields(input, ["kind", "textRef", "text", "originalText"], "set-text");
      return expectSync(sdk.operations.text.setContent({ textRef: sdkRef(input.textRef, "Text ref"), ...textContent(input) } as never));
    case "set-text-style":
      assertKnownFields(input, ["kind", "textRef", "style", "fontFamily", "fontSize", "color", "textAlign", "verticalAlign", "opacity", "lineHeight"], "set-text-style");
      return expectSync(sdk.operations.text.setStyle({ textRef: sdkRef(input.textRef, "Text ref"), ...textStyle(input) } as never));
    case "set-text-layout":
      assertKnownFields(input, ["kind", "textRef", "layout", "autoResize", "width"], "set-text-layout");
      return expectSync(sdk.operations.text.setLayout({ textRef: sdkRef(input.textRef, "Text ref"), ...textLayout(input) } as never));
    default:
      throw new AdapterError(`Unsupported semantic drawing operation: ${String(input.kind)}`, "toolValidationFailed");
  }
}

function operationFromLayout(sdk: IdeaSketchSdk, raw: unknown): IdeaSketchOperation {
  const input = asRecord(raw);
  if (input.kind === "move-element") {
    assertKnownFields(input, ["kind", "elementRef", "dx", "dy"], "move-element");
    return expectSync(sdk.operations.element.move({
      elementRef: sdkRef(input.elementRef, "Element ref"),
      dx: input.dx,
      dy: input.dy,
    } as never));
  }
  if (input.kind === "resize-element") {
    assertKnownFields(input, ["kind", "elementRef", "width", "height"], "resize-element");
    return expectSync(sdk.operations.element.resize({
      elementRef: sdkRef(input.elementRef, "Element ref"),
      width: input.width,
      height: input.height,
      anchor: "top-left",
    } as never));
  }
  throw new AdapterError(`Unsupported semantic layout operation: ${String(input.kind)}`, "toolValidationFailed");
}

function semanticOperations(sdk: IdeaSketchSdk, value: unknown, kind: "drawing" | "layout", options: { allowLegacyConnectorStyle?: boolean } = {}) {
  if (!Array.isArray(value) || value.length === 0) throw new AdapterError("A non-empty operation list is required.", "toolValidationFailed");
  return value.map((item) => kind === "drawing" ? operationFromDrawing(sdk, item, options) : operationFromLayout(sdk, item));
}

function pageSeedOperations(sdk: IdeaSketchSdk, value: unknown) {
  const input = asRecord(value);
  assertKnownFields(input, ["operations"], "initialScene");
  if (!Array.isArray(input.operations) || input.operations.length === 0) throw new AdapterError("initialScene.operations must be a non-empty array.", "toolValidationFailed");
  const operations = input.operations.map((item) => operationFromDrawing(sdk, item));
  if (operations.some((operation) => !["create-shape", "create-arrow", "create-text", "bind-arrow", "bind-text"].includes(operation.kind))) {
    throw new AdapterError("initialScene contains an unsupported operation.", "toolValidationFailed");
  }
  return { operations };
}

function sdkMutationResult(
  call: AgentToolCall,
  value: IdeaSketchSdkMutationResult,
  operations: readonly IdeaSketchOperation[],
  documentId: string,
  context: IdeaSketchSdkContext | undefined,
): AgentToolMutationResult<IdeaSketchOperation> {
  const changeSet: AgentChangeSet<IdeaSketchOperation> = {
    id: value.changeSetId,
    extensionId: "ideasketch-agent",
    documentId,
    baseRevision: context?.revision ?? value.beforeEditVersion,
    baseDocumentStatus: context?.documentStatus,
    sourceFingerprint: value.beforeDigest,
    summary: `${call.name} applied through the canonical IdeaSketch SDK`,
    operations: [...operations],
    status: "applied",
  };
  return {
    kind: "mutation",
    callId: call.callId,
    name: call.name,
    success: true,
    summary: `Applied: ${call.name}`,
    changeSet,
    truncated: false,
    persistable: true,
    appliedByExecutor: true,
  };
}

function sdkReadResult(call: AgentToolCall, content: unknown, truncated: boolean, persistable = false): AgentToolReadResult {
  return {
    kind: "read",
    callId: call.callId,
    name: call.name,
    success: true,
    summary: `Read ${call.name === "read_active_page" ? "the active IdeaSketch Page" : "the IdeaSketch document outline"}`,
    content,
    truncated,
    persistable,
  };
}

export function createIdeaSketchAgentSdkToolExecutor({
  protocol,
  documentId,
  callerId = `ideasketch-agent:${documentId}:${crypto.randomUUID()}`,
  legacyExecutor,
}: {
  protocol: AgentToolProtocolBinding;
  documentId: string;
  callerId?: string;
  legacyExecutor?: AgentToolExecutor;
}): AgentToolExecutor & { readonly mutationToolNames: readonly string[]; readonly protocol: AgentToolProtocolBinding } {
  let boundProtocol: AgentToolProtocolBinding;
  try {
    boundProtocol = getIdeaSketchAgentToolProtocol(protocol.version);
  } catch {
    throw new Error("The IdeaSketch Agent Tool protocol binding is malformed.");
  }
  if (protocol.schemaDigest !== boundProtocol.schemaDigest) {
    throw new Error("The IdeaSketch Agent Tool schema digest does not match the protocol binding.");
  }
  const callerProfile = boundProtocol.version.major === 1 ? "agent-v1" : "agent-v2";
  const cancelled = new Set<string>();
  const controllers = new Map<string, AbortController>();
  let sdkPromise: Promise<SdkResult<IdeaSketchSdk>> | undefined;
  let documentSnapshotId: string | undefined;
  let sceneSnapshotId: string | undefined;
  let activePageRef: string | undefined;
  let lastContext: IdeaSketchSdkContext | undefined;

  const getSdk = () => {
    sdkPromise ??= getActiveIdeaSketchSdkHost().createSession({
      caller: createIdeaSketchHostCaller({ id: callerId, profile: callerProfile }),
      sdkProtocolVersion: IDEA_SKETCH_SDK_PROTOCOL_VERSION,
      agentToolProtocolVersion: boundProtocol.version,
      expectedAgentSchemaDigest: boundProtocol.schemaDigest,
    });
    return sdkPromise;
  };

  const execute = async (call: AgentToolCall, signal?: AbortSignal) => {
    if (signal?.aborted || cancelled.has(call.callId)) return failure(call, "Editor Tool call was cancelled.", "toolExecutionFailed");
    if (!boundProtocol.tools.some((tool) => tool.name === call.name)) return failure(call, `Editor Tool is not registered for protocol v${boundProtocol.version.major}: ${call.name}`, "toolValidationFailed");

    const controller = new AbortController();
    controllers.set(call.callId, controller);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      if (cancelled.has(call.callId) || signal?.aborted) return failure(call, "Editor Tool call was cancelled.", "toolExecutionFailed");
      const sdkResult = await getSdk();
      if (sdkResult.status !== "succeeded") throw resultError(sdkResult);
      const sdk = sdkResult.value;
      if (call.name === "read_document_outline") {
        const readArgs = asRecord(call.arguments);
        const contextResult = await sdk.context.get();
        if (contextResult.status !== "succeeded") throw resultError(contextResult);
        lastContext = contextResult.value;
        const pagesResult = protocol.version.major === 2
          ? await sdk.pages.list(boundedReadOptions(readArgs, "document") as never)
          : await sdk.pages.list();
        if (pagesResult.status !== "succeeded") throw resultError(pagesResult);
        documentSnapshotId = pagesResult.value.documentSnapshotId;
        const pages = protocol.version.major === 1
          ? pagesResult.value.pages.map((page) => ({
              id: String(page.pageRef).slice("page:".length),
              pageRef: page.pageRef,
              index: page.index,
              title: page.title,
              elementCount: page.elementCount,
              cameraCount: page.cameraCount,
            }))
          : pagesResult.value.pages;
        return sdkReadResult(call, {
          documentSnapshotId,
          pageCount: pagesResult.value.pages.length,
          pages,
          complete: pagesResult.value.complete,
          ...(protocol.version.major === 1 ? { truncated: !pagesResult.value.complete } : {}),
          nextCursor: pagesResult.value.nextCursor,
          coverage: pagesResult.value.coverage,
        }, !pagesResult.value.complete, protocol.version.major === 1);
      }
      if (call.name === "read_active_page") {
        const readArgs = asRecord(call.arguments);
        const contextResult = await sdk.context.get();
        if (contextResult.status !== "succeeded") throw resultError(contextResult);
        lastContext = contextResult.value;
        const sceneResult = protocol.version.major === 2
          ? await sdk.scene.read({
              pageRef: contextResult.value.activePageRef,
              ...boundedReadOptions(readArgs, "scene"),
            } as never)
          // Preserve the published v1 compatibility projection's 80-element
          // bound. The canonical SDK default is intentionally smaller (50),
          // which would make otherwise-complete v1 reads appear truncated.
          : await sdk.scene.read({ pageRef: contextResult.value.activePageRef, limit: LEGACY_V1_SCENE_READ_LIMIT });
        if (sceneResult.status !== "succeeded") throw resultError(sceneResult);
        sceneSnapshotId = sceneResult.value.snapshotId;
        activePageRef = sceneResult.value.pageRef;
        let legacyPageSummary: {
          id: string;
          title: string;
          elementCount: number;
          cameraCount: number;
        } | undefined;
        if (protocol.version.major === 1) {
          const pagesResult = await sdk.pages.list({ limit: LEGACY_V1_SCENE_READ_LIMIT });
          if (pagesResult.status === "succeeded") {
            documentSnapshotId = pagesResult.value.documentSnapshotId;
            const summary = pagesResult.value.pages.find((page) => page.pageRef === sceneResult.value.pageRef);
            if (summary) {
              legacyPageSummary = {
                id: String(summary.pageRef).slice("page:".length),
                title: summary.title,
                elementCount: summary.elementCount,
                cameraCount: summary.cameraCount,
              };
            }
          }
        }
        return sdkReadResult(call, {
          id: legacyPageSummary?.id ?? String(sceneResult.value.pageRef).slice("page:".length),
          ...(legacyPageSummary ? {
            title: legacyPageSummary.title,
            elementCount: legacyPageSummary.elementCount,
            cameraCount: legacyPageSummary.cameraCount,
            truncated: !sceneResult.value.complete,
          } : {}),
          pageRef: sceneResult.value.pageRef,
          snapshotId: sceneResult.value.snapshotId,
          pageEditVersion: sceneResult.value.pageEditVersion,
          elements: sceneResult.value.elements,
          elementLimit: protocol.version.major === 1 ? LEGACY_V1_SCENE_READ_LIMIT : sceneResult.value.elements.length,
          returnedElementCount: sceneResult.value.elements.length,
          complete: sceneResult.value.complete,
          ...(sceneResult.value.nextCursor ? { nextCursor: sceneResult.value.nextCursor } : {}),
          coverage: sceneResult.value.coverage,
        }, !sceneResult.value.complete);
      }

      // `replace_page_elements` is the sole raw v1 compatibility edge.  It
      // remains explicitly pinned to v1 and must still prove the same active
      // Page read receipt before the host-internal legacy executor is called.
      if (boundProtocol.version.major === 1 && call.name === "replace_page_elements") {
        if (!legacyExecutor) throw new AdapterError("Legacy replace_page_elements compatibility is unavailable.", "toolExecutionFailed");
        if (!sceneSnapshotId || !activePageRef) throw new AdapterError("Call read_active_page before replacing Page elements.", "toolValidationFailed");
        const rawArgs = asRecord(call.arguments);
        assertKnownFields(rawArgs, ["pageId", "elements"], "replace_page_elements");
        if (pageRef(rawArgs.pageId) !== activePageRef) throw new AdapterError("Legacy replacement must target the Page returned by read_active_page.", "toolValidationFailed");
        const verified = await sdk.scene.read({ pageRef: activePageRef as never, snapshotId: sceneSnapshotId as never });
        if (verified.status !== "succeeded") throw resultError(verified);
        const result = await legacyExecutor.execute(call, controller.signal);
        sceneSnapshotId = undefined;
        activePageRef = undefined;
        documentSnapshotId = undefined;
        return result;
      }

      const args = asRecord(call.arguments);
      if (call.name === "add_page") assertKnownFields(
        args,
        boundProtocol.version.major === 1 ? ["title", "elements"] : ["title", "initialScene"],
        "add_page",
      );
      if (call.name === "delete_page") assertKnownFields(args, ["pageId"], "delete_page");
      if (call.name === "reorder_page") assertKnownFields(args, ["pageId", "toIndex"], "reorder_page");
      // v1 `add_page` is a raw compatibility Tool even when the caller asks
      // for a blank Page (`elements: []`). Keep the complete legacy input and
      // prerequisite behavior version-pinned instead of making the empty case
      // unexpectedly require a canonical outline snapshot.
      if (boundProtocol.version.major === 1 && call.name === "add_page") {
        if (typeof args.title !== "string" || args.title.trim().length === 0 || !Array.isArray(args.elements)) {
          throw new AdapterError("Legacy add_page requires a title and elements array.", "toolValidationFailed");
        }
        if (legacyExecutor) {
          const result = await legacyExecutor.execute(call, controller.signal);
          documentSnapshotId = undefined;
          sceneSnapshotId = undefined;
          activePageRef = undefined;
          return result;
        }
        throw new AdapterError("Legacy add_page elements require a compatibility executor.", "toolExecutionFailed");
      }
      if (call.name === "add_page" || call.name === "delete_page" || call.name === "reorder_page") {
        if (boundProtocol.version.major === 1 && !documentSnapshotId && (call.name === "delete_page" || call.name === "reorder_page")) {
          const pagesResult = await sdk.pages.list();
          if (pagesResult.status !== "succeeded") throw resultError(pagesResult);
          documentSnapshotId = pagesResult.value.documentSnapshotId;
        }
        if (!documentSnapshotId) throw new AdapterError("Call read_document_outline before a Page mutation.", "toolValidationFailed");
        let operation: IdeaSketchOperation;
        if (call.name === "add_page") {
          const initialScene = args.initialScene === undefined ? undefined : pageSeedOperations(sdk, args.initialScene);
          operation = expectSync(sdk.operations.page.add({
            ref: `temp:page-${call.callId}`,
            ...(args.title === undefined ? {} : { title: args.title }),
            ...(initialScene ? { initialScene } : {}),
          } as never));
        } else if (call.name === "delete_page") {
          operation = expectSync(sdk.operations.page.delete({ pageRef: pageRef(args.pageId) } as never));
        } else {
          operation = expectSync(sdk.operations.page.reorder({ pageRef: pageRef(args.pageId), toIndex: args.toIndex } as never));
        }
        const applied = await sdk.pages.applyPlan({
          requestId: call.callId,
          documentSnapshotId: documentSnapshotId as never,
          operations: [operation as never],
          signal: controller.signal,
        });
        if (applied.status !== "succeeded") throw resultError(applied);
        documentSnapshotId = undefined;
        return sdkMutationResult(call, applied.value, [operation], documentId, lastContext);
      }

      if (call.name === "apply_drawing_plan" || call.name === "apply_layout_plan") {
        if (!sceneSnapshotId || !activePageRef) throw new AdapterError("Call read_active_page before a scene mutation.", "toolValidationFailed");
        if (typeof args.pageId !== "string" || pageRef(args.pageId) !== activePageRef) throw new AdapterError("Scene mutations must target the Page returned by read_active_page.", "toolValidationFailed");
        const operations = semanticOperations(
          sdk,
          args.operations,
          call.name === "apply_drawing_plan" ? "drawing" : "layout",
          { allowLegacyConnectorStyle: boundProtocol.version.major === 1 },
        );
        const applied = await sdk.scene.applyPlan({
          requestId: call.callId,
          snapshotId: sceneSnapshotId as never,
          operations,
          signal: controller.signal,
        });
        if (applied.status !== "succeeded") throw resultError(applied);
        sceneSnapshotId = undefined;
        activePageRef = undefined;
        return sdkMutationResult(call, applied.value, operations, documentId, lastContext);
      }
      throw new AdapterError(`Unsupported IdeaSketch Tool: ${call.name}`, "toolValidationFailed");
    } catch (cause) {
      if (cause instanceof AdapterError) return failure(call, cause.message, cause.code);
      return failure(call, cause instanceof Error ? cause.message : String(cause), "toolExecutionFailed");
    } finally {
      signal?.removeEventListener("abort", onAbort);
      controllers.delete(call.callId);
    }
  };

  return {
    execute,
    cancel(callId) {
      cancelled.add(callId);
      controllers.get(callId)?.abort();
      legacyExecutor?.cancel(callId);
    },
    async dispose() {
      const result = sdkPromise ? await sdkPromise : undefined;
      if (result?.status === "succeeded") await result.value.session.dispose();
      await legacyExecutor?.dispose?.();
    },
    mutationToolNames: Object.freeze(boundProtocol.tools.filter((tool) => tool.effect !== "read").map((tool) => tool.name)),
    protocol: boundProtocol,
  };
}

export const IDEA_SKETCH_AGENT_PROTOCOL_DIGESTS = AGENT_TOOL_SCHEMA_DIGESTS;
