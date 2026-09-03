import { CaptureUpdateAction, restoreElements } from "@excalidraw/excalidraw";
import { message } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import type { DocumentModel, DocumentSession, IdeaSketchDocument, IdeaSketchPage } from "../types";
import { useEditorSession } from "../hooks/useEditorSession";
import { useAutoSave } from "../hooks/useAutoSave";
import { useSettings } from "../hooks/useSettings";
import {
  createEmptyIdeaSketchPage,
  createIdeaSketchEditorState,
  ideaSketchReducer,
  type IdeaSketchAction,
  type IdeaSketchEditorState,
} from "../lib/ideaSketchReducer";
import { extractCameras, type Camera } from "../lib/cameraUtils";
import { chooseExcalidrawFile, isDesktopOperationCancelled } from "../lib/tauriCommands";
import type { StyleConversionTarget } from "../lib/excalidrawStyleConversion";
import { SlideCanvas } from "./SlideCanvas";
import { ResizableDivider } from "./ResizableDivider";
import {
  ActionsToggleButton,
  IdeaSketchDrawerCommands,
} from "./IdeaSketchDrawerCommands";
import { IdeaSketchClearCanvasDialog } from "./IdeaSketchClearCanvasDialog";
import type { ActiveAgentEditorBinding, AgentChangeSet } from "../lib/agent/types";
import { createAgentToolHost } from "../lib/agent/agentToolHost";
import {
  ideaSketchAgentExtension,
  getIdeaSketchSourceFingerprint,
  type IdeaSketchAgentOperation,
} from "../lib/agent/extensions/ideaSketchAgentExtension";
import { createIdeaSketchAgentSdkToolExecutor } from "../lib/agent/extensions/ideaSketchAgentSdkAdapter.ts";
import {
  getIdeaSketchAgentToolCatalog,
  getIdeaSketchAgentToolProtocol,
} from "../lib/agent/agentToolProtocol.ts";
import {
  IdeaSketchNavigator,
  type IdeaSketchNavigatorTab,
} from "./IdeaSketchNavigator";
import {
  createIdeaSketchSdkHostRegistrationLifecycle,
  createIdeaSketchHostCaller,
  getActiveIdeaSketchSdkHost,
  type IdeaSketchNativeInteractionReason,
  type IdeaSketchSdkHostTarget,
} from "../lib/ideasketch-sdk/host.ts";
import { IDEA_SKETCH_SDK_PROTOCOL_VERSION } from "../lib/ideasketch-sdk/capabilities.ts";
import type { IdeaSketchSdk } from "../lib/ideasketch-sdk/types.ts";
import { createIdeaSketchRolloutController } from "../lib/ideasketch-sdk/rollout.ts";
import {
  captureIdeaSketchHostScene,
  commitIdeaSketchHostScene,
  deriveLiveNativeInteractionReasons,
  createIdeaSketchSceneCommitSettlements,
  mergeActiveSceneIntoDocument,
  mergeIdeaSketchNativeNormalizedElements,
  type IdeaSketchInternalDocumentCommitRecord,
  type IdeaSketchInternalSceneCommitRecord,
} from "../lib/ideasketch-sdk/editorHostAdapter.ts";
import { validateIdeaSketchScenePostconditions } from "../lib/ideasketch-sdk/scenePostconditions.ts";

const IDEASKETCH_DRAWER_STORAGE_KEY = "ideanote:ideasketch-drawer:v2";
const DEFAULT_DRAWER_WIDTH = 244;
const MIN_DRAWER_WIDTH = 220;
const MAX_DRAWER_WIDTH = 420;
const DEFAULT_IDEASKETCH_AGENT_TOOL_PROTOCOL = getIdeaSketchAgentToolProtocol(2);

interface StoredIdeaSketchDrawerState {
  width?: number;
  tab?: IdeaSketchNavigatorTab;
}

function clampDrawerWidth(width: number) {
  return Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, width));
}

function loadDrawerState(): StoredIdeaSketchDrawerState {
  try {
    const raw = window.localStorage.getItem(IDEASKETCH_DRAWER_STORAGE_KEY);
    if (!raw) return {};
    const stored = JSON.parse(raw) as StoredIdeaSketchDrawerState;
    return {
      width: typeof stored.width === "number" ? clampDrawerWidth(stored.width) : undefined,
      tab: stored.tab === "cameras" ? "cameras" : stored.tab === "pages" ? "pages" : undefined,
    };
  } catch {
    return {};
  }
}

interface IdeaSketchEditorProps {
  document: DocumentSession<IdeaSketchDocument>;
  readOnly?: boolean;
  editorRefreshToken: number;
  onModelChange: (sessionId: string, model: IdeaSketchDocument) => void;
  onDirty: (sessionId: string) => void;
  onEditorStateChange: (sessionId: string, activePageId: string) => void;
  onRegisterSnapshot: (sessionId: string, provider?: () => IdeaSketchDocument) => void;
  onAutoSave: (sessionId: string, model: DocumentModel) => Promise<void>;
  onAutoSaveComplete: (sessionId: string) => void;
  onWriteRecovery: (sessionId: string, model: IdeaSketchDocument) => Promise<void>;
  onStartPresentation: (sessionId: string, page: IdeaSketchPage, mode: "preview" | "fullscreen") => void;
  onAgentBindingChange: (binding: ActiveAgentEditorBinding | undefined, documentId: string) => void;
}

export function IdeaSketchEditor({
  document,
  readOnly = false,
  editorRefreshToken,
  onModelChange,
  onDirty,
  onEditorStateChange,
  onRegisterSnapshot,
  onAutoSave,
  onAutoSaveComplete,
  onWriteRecovery,
  onStartPresentation,
  onAgentBindingChange,
}: IdeaSketchEditorProps) {
  if (!document.model) throw new Error("IdeaSketch document model is missing");
  const { hydrated, settings } = useSettings();
  const [editorState, setEditorState] = useState<IdeaSketchEditorState>(() =>
    createIdeaSketchEditorState(document.model!, document.editorState?.activePageId),
  );
  const editorStateRef = useRef(editorState);
  const emittedModelRef = useRef<IdeaSketchDocument | undefined>(undefined);
  const initialDrawerState = useMemo(loadDrawerState, []);
  const [drawerOpen, setDrawerOpen] = useState(settings.ideaSketch.openSidebarByDefault);
  const drawerDefaultApplied = useRef(false);
  const [drawerWidth, setDrawerWidth] = useState(
    initialDrawerState.width ?? DEFAULT_DRAWER_WIDTH,
  );
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const [navigatorTab, setNavigatorTab] = useState<IdeaSketchNavigatorTab>(
    initialDrawerState.tab ?? "pages",
  );
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const toggleActions = useCallback(() => {
    setActionsExpanded((value) => !value);
  }, []);
  const [canvasLayoutRefreshToken, setCanvasLayoutRefreshToken] = useState(0);
  const [canvasCommandReady, setCanvasCommandReady] = useState(false);
  const [clearCanvasDialogOpen, setClearCanvasDialogOpen] = useState(false);
  const [cameraDrawingRequestToken, setCameraDrawingRequestToken] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const [canvasInteractionActive, setCanvasInteractionActive] = useState(false);
  const [selectionControlsActive, setSelectionControlsActive] = useState(false);
  const excalidrawApiRef = useRef<any>(null);
  const excalidrawSlideIdRef = useRef<string | undefined>(undefined);
  const activeCameraPreviewIdRef = useRef<string | undefined>(undefined);
  const sdkHostRegistration = useMemo(
    () => createIdeaSketchSdkHostRegistrationLifecycle(),
    [],
  );
  const sdkSceneCommitSettlementsRef = useRef(createIdeaSketchSceneCommitSettlements());
  const sdkSceneCommitRecordsRef = useRef<IdeaSketchInternalSceneCommitRecord[]>([]);
  const sdkDocumentCommitRecordsRef = useRef<IdeaSketchInternalDocumentCommitRecord[]>([]);
  const trustedUiSdkRef = useRef<{ documentId: string; promise?: Promise<IdeaSketchSdk | undefined>; sdk?: IdeaSketchSdk }>({ documentId: document.id });
  const rolloutRef = useRef(createIdeaSketchRolloutController());
  const presentationSessionRef = useRef<import("../lib/ideasketch-sdk/types.ts").PresentationSessionId | undefined>(undefined);
  const pendingCameraCreateRef = useRef<{
    requestId: string;
    snapshotId: import("../lib/ideasketch-sdk/types.ts").SceneSnapshotId;
    atIndex?: number;
    resolve: (result: import("../lib/ideasketch-sdk/types.ts").SdkResult<import("../lib/ideasketch-sdk/types.ts").IdeaSketchSdkMutationResult>) => void;
  } | undefined>(undefined);
  const sdkNativeInteractionRef = useRef<{
    epoch: number;
    reasons: readonly IdeaSketchNativeInteractionReason[];
  }>({ epoch: 0, reasons: [] });
  const syncMountedCanvasToPage = useCallback((page: IdeaSketchPage) => {
    const api = excalidrawApiRef.current;
    if (!api || excalidrawSlideIdRef.current !== page.id) return;
    const files = Object.values(page.files ?? {});
    if (files.length > 0) api.addFiles(files);
    api.updateScene({
      elements: page.elements,
      appState: page.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, []);
  const pendingConversionFeedbackRef = useRef<{
    pageId: string;
    message: string;
    selectedElementIds: Record<string, boolean>;
  } | undefined>(undefined);

  useLayoutEffect(() => {
    if (!document.model || document.model === emittedModelRef.current) return;
    const next = createIdeaSketchEditorState(document.model, document.editorState?.activePageId);
    editorStateRef.current = next;
    setEditorState(next);
    const nextActivePage = next.document.pages.find((page) => page.id === next.activePageId);
    if (nextActivePage) syncMountedCanvasToPage(nextActivePage);
  }, [document.editorState?.activePageId, document.model, syncMountedCanvasToPage]);

  useEffect(() => {
    if (!hydrated || drawerDefaultApplied.current) return;
    drawerDefaultApplied.current = true;
    setDrawerOpen(settings.ideaSketch.openSidebarByDefault);
  }, [hydrated, settings.ideaSketch.openSidebarByDefault]);

  useEffect(() => {
    window.localStorage.setItem(IDEASKETCH_DRAWER_STORAGE_KEY, JSON.stringify({
      width: drawerWidth,
      tab: navigatorTab,
    } satisfies StoredIdeaSketchDrawerState));
  }, [drawerWidth, navigatorTab]);

  useEffect(() => {
    setCanvasLayoutRefreshToken((token) => token + 1);
  }, [drawerOpen, drawerWidth]);

  useEffect(() => {
    if (!drawerOpen) setIsResizingDrawer(false);
  }, [drawerOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !drawerOpen) return;
      event.preventDefault();
      event.stopPropagation();
      setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [drawerOpen]);

  const applyAction = useCallback((
    action: IdeaSketchAction,
    persistModel = true,
  ) => {
    const previous = editorStateRef.current;
    const next = ideaSketchReducer(previous, action);
    if (next === previous) return next;
    editorStateRef.current = next;
    setEditorState(next);
    if (next.activePageId !== previous.activePageId) {
      onEditorStateChange(document.id, next.activePageId);
      setSelectedCameraId(undefined);
    }
    if (persistModel && next.document !== previous.document) {
      emittedModelRef.current = next.document;
      onModelChange(document.id, next.document);
    }
    return next;
  }, [document.id, onEditorStateChange, onModelChange]);

  const activePage = editorState.document.pages.find((page) => page.id === editorState.activePageId)
    ?? editorState.document.pages[0]!;

  const handleCommit = useCallback((sessionId: string, pageId: string, payload: { slide: any }) => {
    if (sessionId !== document.id || payload.slide.id !== pageId) return;
    applyAction({ type: "UPDATE_PAGE_SCENE", pageId, page: payload.slide as IdeaSketchPage });
  }, [applyAction, document.id]);
  const handleDirty = useCallback(() => {
    if (!readOnly) onDirty(document.id);
  }, [document.id, onDirty, readOnly]);
  const { autoSaveVersion, draft, flushDraft, getEditVersion, hasPendingCommit, updateDraft } = useEditorSession({
    documentSessionId: document.id,
    page: activePage,
    onCommit: handleCommit,
    onDirty: handleDirty,
  });
  const handleCanvasDraftChange = useCallback((
    elements: readonly any[],
    appState: Partial<any>,
    files: Record<string, any>,
  ) => {
    const previousEditVersion = getEditVersion();
    updateDraft(elements, appState, files);
    if (getEditVersion() === previousEditVersion) return false;
    const current = sdkNativeInteractionRef.current;
    sdkNativeInteractionRef.current = {
      epoch: current.epoch + 1,
      reasons: current.reasons,
    };
    return true;
  }, [getEditVersion, updateDraft]);

  const flushAndGetDocument = useCallback(() => {
    flushDraft();
    return editorStateRef.current.document;
  }, [flushDraft]);

  const createSdkHostTarget = useCallback((): IdeaSketchSdkHostTarget | undefined => {
    const current = editorStateRef.current;
    const page = current.document.pages.find((candidate) => candidate.id === current.activePageId);
    if (!page) return undefined;
    const api = excalidrawApiRef.current;
    const mounted = Boolean(api && excalidrawSlideIdRef.current === current.activePageId);
    const activeCameraPreviewId = activeCameraPreviewIdRef.current;
    const scene = captureIdeaSketchHostScene({
      api: mounted ? api : undefined,
      page,
      activeCameraPreviewId,
    });
    const liveDocument = mergeActiveSceneIntoDocument({
      document: current.document,
      activePageId: current.activePageId,
      scene,
      mounted,
    });
    const nativeInteraction = sdkNativeInteractionRef.current;
    const nativeInteractionReasons = deriveLiveNativeInteractionReasons(
      nativeInteraction.reasons,
      scene.appState,
    );
    const desktopAvailable = Boolean((globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
    return {
      documentSessionId: document.id,
      documentId: document.id,
      activePageId: current.activePageId,
      documentStatus: document.status,
      revision: document.revision,
      sourceModified: document.sourceModified,
      readOnly,
      mountedPageId: mounted ? current.activePageId : undefined,
      pageEditVersion: getEditVersion(),
      nativeInteraction: {
        epoch: nativeInteraction.epoch,
        busy: nativeInteractionReasons.length > 0,
        reasons: nativeInteractionReasons,
      },
      document: liveDocument,
      scene,
      services: {
        mountedCanvas: mounted,
        desktop: desktopAvailable,
        documentUndo: false,
        scene: mounted,
        operations: mounted,
        pages: true,
        cameras: mounted,
        assets: mounted,
        selection: mounted,
        view: mounted,
        transforms: mounted,
        presentation: mounted,
        io: mounted,
        events: true,
        methods: {
          pages: ["list", "select", "parseExcalidraw", "validatePlan", "applyPlan"],
          cameras: ["list", ...(mounted ? ["select", "beginCreate"] : [])],
          assets: ["listMetadata"],
          presentation: ["getState", "start", "stop", "next", "previous", "goToCamera"],
          io: [
            "serializeActivePageAsExcalidraw",
            "serializeActivePageAsIdeaSketch",
            "serializeActivePageAsDrawio",
            "exportActivePageAsExcalidraw",
            "exportActivePageAsIdeaSketch",
            "exportActivePageAsDrawio",
            "openImageExportDialog",
            ...(desktopAvailable ? ["pickExcalidrawAndAddPage"] : []),
          ],
        },
      },
      flushDraft,
      updateSelection: (refs) => {
        if (!mounted || !api || excalidrawApiRef.current !== api) {
          throw new Error("The mounted IdeaSketch canvas is unavailable.");
        }
        const selectedElementIds = Object.fromEntries(refs.map((ref) => [ref.slice(ref.indexOf(":") + 1), true]));
        api.updateScene({
          appState: { selectedElementIds },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      },
      updateViewport: (viewport) => {
        if (!mounted || !api || excalidrawApiRef.current !== api) {
          throw new Error("The mounted IdeaSketch canvas is unavailable.");
        }
        api.updateScene({
          appState: {
            scrollX: viewport.scrollX,
            scrollY: viewport.scrollY,
            zoom: { value: viewport.zoom },
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      },
      viewportSize: mounted && api
        ? { width: Number(api.getAppState().width ?? 0), height: Number(api.getAppState().height ?? 0) }
        : undefined,
      beginCreateCamera,
      openImageExportDialog: () => {
        if (!mounted || !api || excalidrawApiRef.current !== api) throw new Error("The mounted IdeaSketch canvas is unavailable.");
        api.updateScene({
          appState: { openDialog: { name: "imageExport" } },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      },
      chooseExcalidrawImport: chooseExcalidrawFile,
      // The visible Radix confirmation owns the user gesture; the SDK receipt
      // is still issued and consumed before the canonical clear transaction.
      confirmClear: async () => true,
      commitScene: (nextScene) => {
        if (readOnly || !mounted || excalidrawApiRef.current !== api) {
          throw new Error("The mounted IdeaSketch scene is unavailable.");
        }
        const settlement = sdkSceneCommitSettlementsRef.current.begin();
        try {
          const currentScene = captureIdeaSketchHostScene({ api, page, activeCameraPreviewId });
          const normalizedElements = restoreElements(nextScene.elements as any[], currentScene.elements as any[], {
            refreshDimensions: true,
            repairBindings: true,
          });
          const nativeElements = mergeIdeaSketchNativeNormalizedElements({
            currentElements: currentScene.elements,
            nextElements: nextScene.elements,
            normalizedElements,
          });
          const nativeValidation = validateIdeaSketchScenePostconditions({
            elements: nativeElements,
            appState: nextScene.appState,
            files: nextScene.files,
          }, { maxCameraCount: 200, cameraMinWidth: 16, cameraMinHeight: 16 });
          if (nativeValidation.status === "rejected") {
            throw new Error(`Native Excalidraw normalization failed: ${nativeValidation.error.message}`);
          }
          commitIdeaSketchHostScene({
            api,
            currentScene,
            nextScene: { ...nextScene, elements: nativeElements },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            activeCameraPreviewId,
            onCommit: settlement.acknowledge,
          });
        } catch (error) {
          settlement.cancel();
          throw error;
        }
        return { settlement: settlement.promise };
      },
      recordSceneCommit: (record) => {
        sdkSceneCommitRecordsRef.current.push(Object.freeze({
          ...record,
          operationKinds: Object.freeze([...record.operationKinds]),
          affectedRefs: Object.freeze([...record.affectedRefs]),
        }));
      },
      commitDocument: (nextDocument, preferredPageId) => {
        if (readOnly) throw new Error("The IdeaSketch document is read-only.");
        const previous = editorStateRef.current;
        const next = createIdeaSketchEditorState(nextDocument, preferredPageId ?? previous.activePageId);
        editorStateRef.current = next;
        setEditorState(next);
        emittedModelRef.current = next.document;
        onModelChange(document.id, next.document);
        onDirty(document.id);
        if (next.activePageId !== previous.activePageId) {
          onEditorStateChange(document.id, next.activePageId);
        }
      },
      selectPage: (pageId) => {
        applyAction({ type: "SELECT_PAGE", pageId }, false);
      },
      recordDocumentCommit: (record) => {
        sdkDocumentCommitRecordsRef.current.push(Object.freeze({
          ...record,
          operationKinds: Object.freeze([...record.operationKinds]),
          createdPageRefs: Object.freeze([...record.createdPageRefs]),
          updatedPageRefs: Object.freeze([...record.updatedPageRefs]),
          deletedPageRefs: Object.freeze([...record.deletedPageRefs]),
        }));
      },
      cleanupSession: async () => {
        const pending = pendingCameraCreateRef.current;
        pendingCameraCreateRef.current = undefined;
        if (!pending) return;
        pending.resolve({
          status: "cancelled",
          error: {
            code: "cancelled_before_commit",
            message: "Camera creation was cancelled because the SDK session was disposed.",
            retryable: true,
          },
        });
        setCameraDrawingRequestToken((token) => token + 1);
      },
    };
  }, [
    document.id,
    document.revision,
    document.sourceModified,
    document.status,
    flushDraft,
    getEditVersion,
    onEditorStateChange,
    onModelChange,
    onDirty,
    readOnly,
  ]);

  useLayoutEffect(
    () => sdkHostRegistration.mount(createSdkHostTarget),
    [createSdkHostTarget, sdkHostRegistration],
  );

  useEffect(() => {
    onRegisterSnapshot(document.id, flushAndGetDocument);
    return () => onRegisterSnapshot(document.id, undefined);
  }, [document.id, flushAndGetDocument, onRegisterSnapshot]);

  useAutoSave({
    enabled: Boolean(document.filePath) && !readOnly && document.status === "editable",
    sessionId: document.id,
    filePath: document.filePath,
    revision: autoSaveVersion,
    isDirty: document.isDirty || hasPendingCommit,
    getModel: flushAndGetDocument,
    getEditVersion,
    onSave: (model) => onAutoSave(document.id, model),
    onSaveComplete: () => onAutoSaveComplete(document.id),
    onSaveError: (error) => console.error(`Auto-save failed for ${document.displayName ?? document.filePath}:`, error),
  });

  useEffect(() => {
    if (readOnly || (!document.isDirty && !hasPendingCommit)) return;
    const timer = window.setTimeout(() => {
      onWriteRecovery(document.id, flushAndGetDocument()).catch((error) => {
        console.warn(`Recovery draft could not be written for ${document.displayName ?? document.filePath}:`, error);
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [autoSaveVersion, document.displayName, document.filePath, document.id, document.isDirty, document.revision, flushAndGetDocument, hasPendingCommit, onWriteRecovery, readOnly]);

  const cameras = useMemo(() => extractCameras(draft.elements), [draft.elements]);
  const activeCameraId = selectedCameraId && cameras.some((camera) => camera.id === selectedCameraId)
    ? selectedCameraId
    : undefined;

  const getTrustedUiSdk = useCallback(async (): Promise<IdeaSketchSdk | undefined> => {
    if (trustedUiSdkRef.current.documentId !== document.id) {
      void trustedUiSdkRef.current.sdk?.session.dispose();
      trustedUiSdkRef.current = { documentId: document.id };
    }
    if (!trustedUiSdkRef.current.promise) {
      trustedUiSdkRef.current.promise = (async () => {
        const callerId = `trusted-ui:${document.id}`;
        for (const namespace of ["pages", "scene", "cameras", "selection", "view", "transforms", "presentation", "io", "events"] as const) {
          const selected = rolloutRef.current.select({ callerId, namespace, sdkAvailable: true });
          if (selected.status !== "succeeded") return undefined;
        }
        const result = await getActiveIdeaSketchSdkHost().createSession({
          caller: createIdeaSketchHostCaller({ id: callerId, profile: "trusted-ui" }),
          sdkProtocolVersion: IDEA_SKETCH_SDK_PROTOCOL_VERSION,
        });
        if (result.status !== "succeeded") return undefined;
        trustedUiSdkRef.current.sdk = result.value;
        return result.value;
      })();
    }
    return trustedUiSdkRef.current.promise;
  }, [document.id]);

  const applyPagePlan = useCallback(async (operations: readonly any[], requestId: string) => {
    const sdk = await getTrustedUiSdk();
    if (!sdk) return undefined;
    const listed = await sdk.pages.list();
    if (listed.status !== "succeeded") return listed;
    return sdk.pages.applyPlan({ requestId, documentSnapshotId: listed.value.documentSnapshotId, operations });
  }, [getTrustedUiSdk]);

  const exportActivePageAsDrawio = useCallback(async () => {
    const sdk = await getTrustedUiSdk();
    const result = await sdk?.io.exportActivePageAsDrawio();
    if (result?.status === "succeeded" && typeof result.value === "object" && result.value !== null && "fileName" in result.value) {
      excalidrawApiRef.current?.setToast({ message: `Exported ${(result.value as { fileName: string }).fileName}`, duration: 4200 });
    } else if (result?.status === "rejected") {
      excalidrawApiRef.current?.setToast({ message: result.error.message, duration: 4200 });
    }
  }, [getTrustedUiSdk]);

  const changeCanvasBackground = useCallback(async (color: string) => {
    if (readOnly) return;
    const sdk = await getTrustedUiSdk();
    const sceneRead = await sdk?.scene.read({ limit: 100 });
    if (!sdk || !sceneRead || sceneRead.status !== "succeeded") return;
    const result = await sdk.scene.applyPlan({
      requestId: `ui-background:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      snapshotId: sceneRead.value.snapshotId,
      operations: [{ kind: "set-background", version: 1, color }],
    });
    if (result.status === "rejected") excalidrawApiRef.current?.setToast({ message: result.error.message, duration: 4200 });
  }, [getTrustedUiSdk, readOnly]);

  const clearCanvas = useCallback(async () => {
    if (readOnly) return;
    const sdk = await getTrustedUiSdk();
    if (!sdk) return;
    const sceneRead = await sdk.scene.read({ limit: 100 });
    if (sceneRead.status !== "succeeded") return;
    const confirmation = await sdk.scene.requestClearConfirmation({ snapshotId: sceneRead.value.snapshotId, scope: "all-elements" });
    if (confirmation.status !== "succeeded") return;
    const result = await sdk.scene.applyPlan({
      requestId: `ui-clear:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      snapshotId: sceneRead.value.snapshotId,
      operations: [{ kind: "clear-scene", version: 1, scope: "all-elements", confirmationReceipt: confirmation.value }],
    });
    if (result.status === "rejected") excalidrawApiRef.current?.setToast({ message: result.error.message, duration: 4200 });
  }, [getTrustedUiSdk, readOnly]);

  const selectPage = useCallback(async (pageId: string) => {
    const sdk = await getTrustedUiSdk();
    const result = await sdk?.pages.select({ pageRef: `page:${pageId}` });
    if (result?.status === "rejected") console.warn(result.error.message);
  }, [getTrustedUiSdk]);
  const addPage = useCallback(async () => {
    if (readOnly) return;
    const result = await applyPagePlan([{ kind: "add-page", version: 1, ref: "temp:new-page", title: `Page ${editorStateRef.current.document.pages.length + 1}` }], `ui-add-page:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
    if (result?.status === "rejected") console.warn(result.error.message);
  }, [applyPagePlan, readOnly]);
  const duplicatePage = useCallback(async (pageId: string) => {
    if (readOnly) return;
    const result = await applyPagePlan([{ kind: "duplicate-page", version: 1, ref: "temp:duplicate-page", sourcePageRef: `page:${pageId}` }], `ui-duplicate-page:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
    if (result?.status === "rejected") console.warn(result.error.message);
  }, [applyPagePlan, readOnly]);
  const importPage = useCallback(async () => {
    if (readOnly) return;
    try {
      const sdk = await getTrustedUiSdk();
      const result = await sdk?.io.pickExcalidrawAndAddPage({ requestId: `ui-import-page:${globalThis.crypto?.randomUUID?.() ?? Date.now()}` });
      if (result?.status === "rejected") throw new Error(result.error.message);
    } catch (error) {
      if (isDesktopOperationCancelled(error)) return;
      await message(`The Excalidraw page could not be imported: ${error instanceof Error ? error.message : String(error)}`, {
        title: "Import Error",
        kind: "error",
      });
    }
  }, [getTrustedUiSdk, readOnly]);
  const renamePage = useCallback(async (pageId: string, title: string) => {
    if (readOnly) return;
    const result = await applyPagePlan([{ kind: "rename-page", version: 1, pageRef: `page:${pageId}`, title }], `ui-rename-page:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
    if (result?.status === "rejected") console.warn(result.error.message);
  }, [applyPagePlan, readOnly]);
  const reorderPage = useCallback(async (pageId: string, toIndex: number) => {
    if (readOnly) return;
    const result = await applyPagePlan([{ kind: "reorder-page", version: 1, pageRef: `page:${pageId}`, toIndex }], `ui-reorder-page:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
    if (result?.status === "rejected") console.warn(result.error.message);
  }, [applyPagePlan, readOnly]);
  const deletePage = useCallback(async (pageId: string) => {
    if (readOnly) return;
    const result = await applyPagePlan([{ kind: "delete-page", version: 1, pageRef: `page:${pageId}` }], `ui-delete-page:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`);
    if (result?.status === "rejected") console.warn(result.error.message);
  }, [applyPagePlan, readOnly]);

  const selectCamera = useCallback(async (camera: Camera) => {
    const sdk = await getTrustedUiSdk();
    const sceneRead = await sdk?.scene.read({ limit: 100 });
    if (!sdk || !sceneRead || sceneRead.status !== "succeeded") return;
    const result = await sdk.cameras.select({ snapshotId: sceneRead.value.snapshotId, cameraRef: `camera:${camera.id}` as import("../lib/ideasketch-sdk/types.ts").CameraRef });
    if (result.status === "succeeded") setSelectedCameraId(camera.id);
  }, [getTrustedUiSdk]);
  const deleteCamera = useCallback(async (cameraId: string) => {
    if (readOnly) return;
    const sdk = await getTrustedUiSdk();
    const sceneRead = await sdk?.scene.read({ limit: 100 });
    if (!sdk || !sceneRead || sceneRead.status !== "succeeded") return;
    const result = await sdk.scene.applyPlan({
      requestId: `ui-delete-camera:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      snapshotId: sceneRead.value.snapshotId,
      operations: [{ kind: "delete-camera", version: 1, cameraRef: `camera:${cameraId}` as import("../lib/ideasketch-sdk/types.ts").CameraRef }],
    });
    if (result.status === "succeeded" && activeCameraId === cameraId) setSelectedCameraId(undefined);
  }, [activeCameraId, getTrustedUiSdk, readOnly]);
  const reorderCameraList = useCallback(async (orderedCameraIds: string[]) => {
    if (readOnly) return;
    const sdk = await getTrustedUiSdk();
    const sceneRead = await sdk?.scene.read({ limit: 100 });
    if (!sdk || !sceneRead || sceneRead.status !== "succeeded") return;
    const result = await sdk.scene.applyPlan({
      requestId: `ui-reorder-camera:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      snapshotId: sceneRead.value.snapshotId,
      operations: [{ kind: "set-camera-order", version: 1, cameraRefs: orderedCameraIds.map((id) => `camera:${id}` as import("../lib/ideasketch-sdk/types.ts").CameraRef) }],
    });
    if (result.status === "rejected") console.warn(result.error.message);
  }, [getTrustedUiSdk, readOnly]);
  const startPresentation = useCallback(async (mode: "preview" | "fullscreen") => {
    const model = flushAndGetDocument();
    const page = model.pages.find((candidate) => candidate.id === editorStateRef.current.activePageId);
    if (!page) return;
    const sdk = await getTrustedUiSdk();
    const result = await sdk?.presentation.start({ mode, pageRef: `page:${page.id}` });
    if (result?.status === "succeeded") {
      presentationSessionRef.current = (result.value as { presentationSessionId: import("../lib/ideasketch-sdk/types.ts").PresentationSessionId }).presentationSessionId;
      onStartPresentation(document.id, page, mode);
    }
    else if (result?.status === "rejected") excalidrawApiRef.current?.setToast({ message: result.error.message, duration: 4200 });
  }, [document.id, flushAndGetDocument, getTrustedUiSdk, onStartPresentation]);
  useEffect(() => {
    const handlePresentationStop = () => {
      const sessionId = presentationSessionRef.current;
      const sdk = trustedUiSdkRef.current.sdk;
      if (!sessionId || !sdk) return;
      presentationSessionRef.current = undefined;
      void sdk.presentation.stop({ presentationSessionId: sessionId });
    };
    window.addEventListener("ideasketch:presentation-stop", handlePresentationStop);
    return () => window.removeEventListener("ideasketch:presentation-stop", handlePresentationStop);
  }, []);
  const reportExportError = useCallback(async (error: unknown) => {
    if (isDesktopOperationCancelled(error)) return;
    await message(`The Page could not be exported: ${error instanceof Error ? error.message : String(error)}`, {
      title: "Export Error",
      kind: "error",
    });
  }, []);
  const exportActivePageAsExcalidraw = useCallback(async () => {
    try {
      const sdk = await getTrustedUiSdk();
      const result = await sdk?.io.exportActivePageAsExcalidraw();
      if (result?.status === "succeeded" && typeof result.value === "object" && result.value !== null && "fileName" in result.value) excalidrawApiRef.current?.setToast({ message: `Exported ${(result.value as { fileName: string }).fileName}`, duration: 4200 });
    } catch (error) {
      await reportExportError(error);
    }
  }, [getTrustedUiSdk, reportExportError]);
  const exportActivePageAsIdeaSketch = useCallback(async () => {
    try {
      const sdk = await getTrustedUiSdk();
      const result = await sdk?.io.exportActivePageAsIdeaSketch();
      if (result?.status === "succeeded" && typeof result.value === "object" && result.value !== null && "fileName" in result.value) excalidrawApiRef.current?.setToast({ message: `Exported ${(result.value as { fileName: string }).fileName}`, duration: 4200 });
    } catch (error) {
      await reportExportError(error);
    }
  }, [getTrustedUiSdk, reportExportError]);
  const handleApiReady = useCallback((api: any | undefined, slideId: string) => {
    if (!api) {
      if (excalidrawSlideIdRef.current !== slideId) return;
      sdkSceneCommitSettlementsRef.current.clear();
      excalidrawApiRef.current = null;
      excalidrawSlideIdRef.current = undefined;
      setCanvasCommandReady(false);
      return;
    }
    if (
      excalidrawApiRef.current
      && (excalidrawApiRef.current !== api || excalidrawSlideIdRef.current !== slideId)
    ) {
      sdkSceneCommitSettlementsRef.current.clear();
    }
    excalidrawApiRef.current = api;
    excalidrawSlideIdRef.current = slideId;
    setCanvasCommandReady(true);
    const pendingFeedback = pendingConversionFeedbackRef.current;
    if (!pendingFeedback || pendingFeedback.pageId !== slideId) return;

    pendingConversionFeedbackRef.current = undefined;
    window.requestAnimationFrame(() => {
      if (excalidrawApiRef.current !== api || excalidrawSlideIdRef.current !== slideId) return;
      api.setActiveTool({ type: "selection" });
      const selectedElements = api.getSceneElements().filter(
        (element: any) => pendingFeedback.selectedElementIds[element.id],
      );
      if (selectedElements.length > 0) {
        api.scrollToContent(selectedElements, { fitToContent: true, animate: true, duration: 300 });
      }
      api.setToast({ message: pendingFeedback.message, duration: 4200 });
    });
  }, []);
  useEffect(() => () => {
    sdkSceneCommitSettlementsRef.current.clear();
    presentationSessionRef.current = undefined;
    const pending = pendingCameraCreateRef.current;
    pendingCameraCreateRef.current = undefined;
    pending?.resolve({ status: "cancelled", error: { code: "cancelled_before_commit", message: "Camera creation was cancelled because the editor closed.", retryable: true } });
    void trustedUiSdkRef.current.sdk?.session.dispose();
  }, []);
  const handleConvertSelection = useCallback(async (target: StyleConversionTarget) => {
    const api = excalidrawApiRef.current;
    const mountedPageId = excalidrawSlideIdRef.current;
    if (
      !api ||
      readOnly ||
      !mountedPageId ||
      mountedPageId !== editorStateRef.current.activePageId
    ) {
      return;
    }

    const sceneAppState = api.getAppState();
    const selectedElementIds = sceneAppState.selectedElementIds as Record<string, boolean> | undefined;
    const selectedRefs = Object.entries(selectedElementIds ?? {})
      .filter(([, selected]) => selected)
      .map(([id]) => `element:${id}` as import("../lib/ideasketch-sdk/types.ts").ElementRef);
    if (selectedRefs.length === 0) return;
    const sdk = await getTrustedUiSdk();
    if (!sdk) return;
    const sceneRead = await sdk.scene.read({ limit: 100 });
    if (sceneRead.status !== "succeeded") return;
    let documentSnapshotId;
    if (target === "new-page") {
      const pagesRead = await sdk.pages.list();
      if (pagesRead.status !== "succeeded") return;
      documentSnapshotId = pagesRead.value.documentSnapshotId;
    }
    const result = await sdk.transforms.convertSelectionStyle({
      requestId: `ui-style-conversion:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      snapshotId: sceneRead.value.snapshotId,
      selectedRefs,
      target,
      preset: "formal",
      ...(documentSnapshotId ? { documentSnapshotId } : {}),
    });
    if (result.status === "succeeded") {
      api.setToast({ message: "Applied formal style preset", duration: 4200 });
    } else if (result.status === "rejected") {
      api.setToast({ message: result.error.message, duration: 4200 });
    }
  }, [getTrustedUiSdk, readOnly]);
  const openDrawer = useCallback((tab: IdeaSketchNavigatorTab) => {
    setNavigatorTab(tab);
    setDrawerOpen(true);
  }, []);
  const handleAddCamera = useCallback(() => {
    if (readOnly) return;
    openDrawer("cameras");
    setCameraDrawingRequestToken((token) => token + 1);
  }, [openDrawer, readOnly]);
  const handleCameraCreateRequest = useCallback(async (bounds: { x: number; y: number; width: number; height: number }) => {
    if (readOnly) return;
    const sdk = await getTrustedUiSdk();
    const sceneRead = await sdk?.scene.read({ limit: 100 });
    if (!sdk || !sceneRead || sceneRead.status !== "succeeded") return;
    const pending = pendingCameraCreateRef.current;
    const requestId = pending?.requestId ?? `ui-create-camera:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    const snapshotId = pending?.snapshotId ?? sceneRead.value.snapshotId;
    const result = await sdk.scene.applyPlan({
      requestId,
      snapshotId,
      operations: [{ kind: "create-camera", version: 1, ref: "temp:new-camera" as import("../lib/ideasketch-sdk/types.ts").TempRef, bounds, ...(pending?.atIndex !== undefined ? { atIndex: pending.atIndex } : {}) }],
    });
    if (pendingCameraCreateRef.current === pending) {
      pendingCameraCreateRef.current = undefined;
      pending?.resolve(result);
    }
    if (result.status === "rejected") {
      excalidrawApiRef.current?.setToast({ message: result.error.message, duration: 4200 });
    }
  }, [getTrustedUiSdk, readOnly]);

  const beginCreateCamera = useCallback(async (input: {
    requestId: string;
    snapshotId: import("../lib/ideasketch-sdk/types.ts").SceneSnapshotId;
    atIndex?: number;
    signal?: AbortSignal;
  }): Promise<import("../lib/ideasketch-sdk/types.ts").SdkResult<import("../lib/ideasketch-sdk/types.ts").IdeaSketchSdkMutationResult>> => {
    if (readOnly) return { status: "rejected", error: { code: "read_only", message: "The IdeaSketch document is read-only.", retryable: false } };
    if (pendingCameraCreateRef.current) return { status: "rejected", error: { code: "editor_busy", message: "A Camera creation interaction is already in progress.", retryable: true } };
    return new Promise((resolve) => {
      const pending = { requestId: input.requestId, snapshotId: input.snapshotId, ...(input.atIndex !== undefined ? { atIndex: input.atIndex } : {}), resolve };
      pendingCameraCreateRef.current = pending;
      const cancel = () => {
        if (pendingCameraCreateRef.current !== pending) return;
        pendingCameraCreateRef.current = undefined;
        resolve({ status: "cancelled", error: { code: "cancelled_before_commit", message: "Camera creation was cancelled.", retryable: true } });
        setCameraDrawingRequestToken((token) => token + 1);
      };
      input.signal?.addEventListener("abort", cancel, { once: true });
      openDrawer("cameras");
      setCameraDrawingRequestToken((token) => token + 1);
    });
  }, [openDrawer, readOnly]);
  const handleCanvasInteractionChange = useCallback((active: boolean) => {
    setCanvasInteractionActive((current) => current === active ? current : active);
  }, []);
  const handleNativeInteractionChange = useCallback((change: {
    active: boolean;
    reason: IdeaSketchNativeInteractionReason;
  }) => {
    const current = sdkNativeInteractionRef.current;
    const reasons = new Set(current.reasons);
    if (change.active) {
      if (reasons.has(change.reason)) return;
      reasons.add(change.reason);
      sdkNativeInteractionRef.current = {
        epoch: current.epoch + 1,
        reasons: [...reasons].sort(),
      };
      return;
    }
    if (!reasons.delete(change.reason)) return;
    sdkNativeInteractionRef.current = {
      epoch: current.epoch,
      reasons: [...reasons].sort(),
    };
  }, []);
  const handleCameraPreviewChange = useCallback((previewId?: string) => {
    activeCameraPreviewIdRef.current = previewId;
  }, []);
  const handleApplyAgentChangeSet = useCallback((changeSet: AgentChangeSet): boolean => {
    if (
      readOnly
      || changeSet.status !== "proposed"
      || changeSet.documentId !== document.id
      || changeSet.extensionId !== ideaSketchAgentExtension.id
      || changeSet.baseRevision !== document.revision
      || changeSet.baseDocumentStatus !== document.status
      || changeSet.baseSourceModified !== document.sourceModified
    ) return false;
    flushDraft();
    const current = editorStateRef.current;
    if (changeSet.sourceFingerprint !== getIdeaSketchSourceFingerprint(current.document)) return false;
    const operations = changeSet.operations as IdeaSketchAgentOperation[];
    if (operations.length !== 1) return false;
    const [operation] = operations;
    try {
      if (operation.kind === "add-page") {
        const base = createEmptyIdeaSketchPage(editorStateRef.current.document.pages.length);
        const restored = restoreElements(operation.elements as any[], null, {
          refreshDimensions: true,
          repairBindings: true,
        });
        applyAction({
          type: "ADD_PAGE",
          page: { ...base, title: operation.title, elements: restored as any[] },
        });
      } else if (operation.kind === "delete-page") {
        if (editorStateRef.current.document.pages.length <= 1) throw new Error("IdeaSketch must keep one Page");
        applyAction({ type: "DELETE_PAGE", pageId: operation.pageId });
      } else if (operation.kind === "reorder-page") {
        applyAction({ type: "REORDER_PAGE", pageId: operation.pageId, toIndex: operation.toIndex });
      } else if (operation.kind === "replace-page-elements") {
        const api = excalidrawApiRef.current;
        if (
          !api
          || operation.pageId !== current.activePageId
          || excalidrawSlideIdRef.current !== operation.pageId
        ) return false;
        const page = current.document.pages.find((candidate) => candidate.id === operation.pageId);
        if (!page) return false;
        const restored = restoreElements(operation.elements as any[], null, {
          refreshDimensions: true,
          repairBindings: true,
        });
        api.updateScene({
          elements: restored as any[],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      }
      return true;
    } catch {
      return false;
    }
  }, [applyAction, document.id, document.revision, document.sourceModified, document.status, flushDraft, readOnly]);
  const agentBindingStateRef = useRef({
    document,
    activeContextId: editorState.activePageId,
    readOnly,
    applyChangeSet: handleApplyAgentChangeSet,
  });
  agentBindingStateRef.current = {
    document,
    activeContextId: editorState.activePageId,
    readOnly,
    applyChangeSet: handleApplyAgentChangeSet,
  };
  const agentBinding = useMemo<ActiveAgentEditorBinding>(() => ({
    get document() { return agentBindingStateRef.current.document; },
    extensionId: ideaSketchAgentExtension.id,
    fileType: ideaSketchAgentExtension.fileType,
    skillId: ideaSketchAgentExtension.skillId,
    tools: ideaSketchAgentExtension.tools,
    get activeContextId() { return agentBindingStateRef.current.activeContextId; },
    get readOnly() { return agentBindingStateRef.current.readOnly; },
    buildContext: () => ideaSketchAgentExtension.buildContext(
      editorStateRef.current.document,
      editorStateRef.current.activePageId,
      agentBindingStateRef.current.document.revision,
    ),
    agentToolProtocol: DEFAULT_IDEASKETCH_AGENT_TOOL_PROTOCOL,
    getToolCatalog: (version) => getIdeaSketchAgentToolCatalog(version ?? 2),
    createToolExecutor: (protocol = DEFAULT_IDEASKETCH_AGENT_TOOL_PROTOCOL) => {
      const context = {
        documentId: agentBindingStateRef.current.document.id,
        revision: agentBindingStateRef.current.document.revision,
        documentStatus: agentBindingStateRef.current.document.status,
        sourceModified: agentBindingStateRef.current.document.sourceModified,
        activeContextId: agentBindingStateRef.current.activeContextId,
        model: structuredClone(editorStateRef.current.document),
      };
      const legacyExecutor = protocol.version.major === 1
        ? createAgentToolHost({ extension: ideaSketchAgentExtension, context })
        : undefined;
      return createIdeaSketchAgentSdkToolExecutor({
        protocol,
        documentId: context.documentId,
        legacyExecutor,
      });
    },
    describeChangeSet: (changeSet) => ideaSketchAgentExtension.describeChangeSet(
      changeSet as AgentChangeSet<IdeaSketchAgentOperation>,
    ),
    applyChangeSet: (changeSet) => agentBindingStateRef.current.applyChangeSet(changeSet),
  }), [document.id]);

  useEffect(() => {
    onAgentBindingChange(agentBinding, document.id);
  }, [agentBinding, document.id, onAgentBindingChange]);

  useEffect(() => () => {
    onAgentBindingChange(undefined, document.id);
  }, [document.id, onAgentBindingChange]);

  const lowerLeftTriggerActive = !drawerOpen && selectionControlsActive;

  return (
    <div className="ideanote-ideasketch-editor">
      <div className={`ideanote-ideasketch-workspace ${drawerOpen ? "is-drawer-open" : ""}`}>
        <div
          className={`ideanote-ideasketch-drawer-shell ${isResizingDrawer ? "is-resizing" : ""}`}
          style={{ width: drawerOpen ? drawerWidth : 0 }}
          aria-hidden={!drawerOpen}
        >
          <aside
            className="ideanote-ideasketch-drawer"
            aria-label="IdeaSketch menu"
            style={{ width: drawerWidth }}
          >
            <div className="ideanote-ideasketch-drawer__navigation">
              <IdeaSketchNavigator
                activeTab={navigatorTab}
                onTabChange={setNavigatorTab}
                headerAction={drawerOpen ? (
                  <button
                    type="button"
                    className="ideanote-ideasketch-drawer-trigger is-drawer is-open"
                    aria-label="Close IdeaSketch menu"
                    aria-expanded={true}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <PanelLeftClose aria-hidden size={16} strokeWidth={1.9} />
                  </button>
                ) : undefined}
                pages={editorState.document.pages}
                activePageId={editorState.activePageId}
                activePageDraft={draft}
                hintTrailing={
                  <ActionsToggleButton
                    expanded={actionsExpanded}
                    onToggle={toggleActions}
                  />
                }
                canvasInteractionActive={canvasInteractionActive}
                cameras={cameras}
                activeCameraId={activeCameraId}
                readOnly={readOnly}
                initialPageViewMode={settings.ideaSketch.pageViewMode}
                pageViewPreferenceReady={hydrated}
                onPageSelect={selectPage}
                onPageAdd={addPage}
                onPageDuplicate={duplicatePage}
                onPageRename={renamePage}
                onPageReorder={reorderPage}
                onPageDelete={deletePage}
                onCameraSelect={selectCamera}
                onCameraDelete={deleteCamera}
                onCameraReorder={reorderCameraList}
                onAddCamera={readOnly ? undefined : handleAddCamera}
                onStartPreview={() => startPresentation("preview")}
                onStartFullscreen={() => startPresentation("fullscreen")}
              />
            </div>
            <IdeaSketchDrawerCommands
              ready={canvasCommandReady}
              readOnly={readOnly}
              expanded={actionsExpanded}
              showHeaderToggle={navigatorTab !== "pages"}
              onToggle={toggleActions}
              backgroundColor={/^#[0-9a-f]{6}$/i.test(String(draft.appState.viewBackgroundColor))
                ? String(draft.appState.viewBackgroundColor)
                : "#ffffff"}
              onImportExcalidraw={importPage}
              onExportExcalidraw={exportActivePageAsExcalidraw}
              onExportIdeaSketch={exportActivePageAsIdeaSketch}
              onExportImage={async () => {
                const sdk = await getTrustedUiSdk();
                await sdk?.io.openImageExportDialog();
              }}
              onExportDrawio={exportActivePageAsDrawio}
              onBackgroundChange={changeCanvasBackground}
              onClearCanvas={() => setClearCanvasDialogOpen(true)}
            />
          </aside>
        </div>
        {drawerOpen && (
          <ResizableDivider
            side="left"
            isVisible={drawerOpen}
            onToggle={() => setDrawerOpen(false)}
            size={drawerWidth}
            minSize={MIN_DRAWER_WIDTH}
            maxSize={MAX_DRAWER_WIDTH}
            panelLabel="IdeaSketch menu"
            showToggle={false}
            onResizeStart={() => setIsResizingDrawer(true)}
            onResizeEnd={() => setIsResizingDrawer(false)}
            onResize={(nextSize) => setDrawerWidth(clampDrawerWidth(nextSize))}
          />
        )}
        <main
          className={`ideanote-ideasketch-canvas ${lowerLeftTriggerActive ? "has-lower-left-trigger" : ""}`}
        >
          {!drawerOpen && (
            <button
              type="button"
              className={`ideanote-ideasketch-drawer-trigger is-canvas ${lowerLeftTriggerActive ? "is-lower-left" : ""}`}
              aria-label="Open IdeaSketch menu"
              aria-expanded={false}
              onClick={() => setDrawerOpen(true)}
            >
              <PanelLeft aria-hidden size={18} strokeWidth={1.9} />
            </button>
          )}
          <SlideCanvas
            key={draft.slideId}
            slideId={draft.slideId}
            pageTitle={activePage.title}
            elements={draft.elements}
            appState={draft.appState}
            files={draft.files}
            onChange={handleCanvasDraftChange}
            onApiReady={handleApiReady}
            onCameraCreateRequest={handleCameraCreateRequest}
            onConvertSelection={handleConvertSelection}
            onSelectionPresenceChange={setSelectionControlsActive}
            onInteractionChange={handleCanvasInteractionChange}
            onNativeInteractionChange={handleNativeInteractionChange}
            onCameraPreviewChange={handleCameraPreviewChange}
            viewMode={readOnly}
            editorRefreshToken={editorRefreshToken}
            layoutRefreshToken={canvasLayoutRefreshToken}
            cameraDrawingRequestToken={cameraDrawingRequestToken}
          />
        </main>
      </div>
      <IdeaSketchClearCanvasDialog
        open={clearCanvasDialogOpen}
        onOpenChange={setClearCanvasDialogOpen}
        onConfirm={() => {
          void clearCanvas();
          setClearCanvasDialogOpen(false);
        }}
      />
    </div>
  );
}
