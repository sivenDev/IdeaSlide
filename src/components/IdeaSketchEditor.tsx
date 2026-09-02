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
import { extractCameras, reorderCameras, type Camera } from "../lib/cameraUtils";
import { chooseExcalidrawFile, isDesktopOperationCancelled } from "../lib/tauriCommands";
import { createIdeaSketchPageFromImport, parseExcalidrawImport } from "../lib/excalidrawImport";
import { exportPageAsExcalidraw, exportPageAsIdeaSketch } from "../lib/ideaSketchPageExport";
import {
  buildCurrentPageStyleConversion,
  buildNewPageStyleConversion,
  formatStyleConversionSummary,
  type StyleConversionTarget,
} from "../lib/excalidrawStyleConversion";
import { SlideCanvas, type SlideCanvasCommandApi } from "./SlideCanvas";
import { ResizableDivider } from "./ResizableDivider";
import {
  ActionsToggleButton,
  IdeaSketchDrawerCommands,
} from "./IdeaSketchDrawerCommands";
import { IdeaSketchClearCanvasDialog } from "./IdeaSketchClearCanvasDialog";
import type { ActiveAgentEditorBinding, AgentChangeSet } from "../lib/agent/types";
import { createAgentToolHost } from "../lib/agent/agentToolHost";
import {
  buildIdeaSketchDrawingPlanScene,
  buildIdeaSketchLayoutPlanScene,
  ideaSketchAgentExtension,
  getIdeaSketchSourceFingerprint,
  isIdeaSketchDrawingOperation,
  isIdeaSketchLayoutOperation,
  type IdeaSketchAgentOperation,
} from "../lib/agent/extensions/ideaSketchAgentExtension";
import {
  IdeaSketchNavigator,
  type IdeaSketchNavigatorTab,
} from "./IdeaSketchNavigator";
import {
  createIdeaSketchSdkHostRegistrationLifecycle,
  type IdeaSketchNativeInteractionReason,
  type IdeaSketchSdkHostTarget,
} from "../lib/ideasketch-sdk/host.ts";
import {
  captureIdeaSketchHostScene,
  commitIdeaSketchHostScene,
  deriveLiveNativeInteractionReasons,
  createIdeaSketchSceneCommitSettlements,
  mergeActiveSceneIntoDocument,
} from "../lib/ideasketch-sdk/editorHostAdapter.ts";

const IDEASKETCH_DRAWER_STORAGE_KEY = "ideanote:ideasketch-drawer:v2";
const DEFAULT_DRAWER_WIDTH = 244;
const MIN_DRAWER_WIDTH = 220;
const MAX_DRAWER_WIDTH = 420;

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

function refreshConvertedTextDimensions(
  elements: readonly any[],
  convertedElementIds: Record<string, boolean>,
) {
  const restoredElements = restoreElements(elements as any[], null, {
    refreshDimensions: true,
    repairBindings: true,
  });
  const restoredById = new Map(restoredElements.map((element) => [element.id, element]));

  return elements.map((element) => (
    element.type === "text" && convertedElementIds[element.id]
      ? restoredById.get(element.id) ?? element
      : element
  ));
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
  const canvasCommandApiRef = useRef<SlideCanvasCommandApi | undefined>(undefined);
  const canvasCommandSlideIdRef = useRef<string | undefined>(undefined);
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
        desktop: Boolean((globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__),
        documentUndo: false,
      },
      flushDraft,
      commitScene: (nextScene) => {
        if (readOnly || !mounted || excalidrawApiRef.current !== api) {
          throw new Error("The mounted IdeaSketch scene is unavailable.");
        }
        const settlement = sdkSceneCommitSettlementsRef.current.begin();
        try {
          commitIdeaSketchHostScene({
            api,
            currentScene: captureIdeaSketchHostScene({ api, page, activeCameraPreviewId }),
            nextScene,
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
      commitDocument: (nextDocument) => {
        if (readOnly) throw new Error("The IdeaSketch document is read-only.");
        const previous = editorStateRef.current;
        const next = createIdeaSketchEditorState(nextDocument, previous.activePageId);
        editorStateRef.current = next;
        setEditorState(next);
        emittedModelRef.current = next.document;
        onModelChange(document.id, next.document);
        if (next.activePageId !== previous.activePageId) {
          onEditorStateChange(document.id, next.activePageId);
        }
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

  const selectPage = useCallback((pageId: string) => {
    flushDraft();
    applyAction({ type: "SELECT_PAGE", pageId }, false);
  }, [applyAction, flushDraft]);
  const addPage = useCallback(() => {
    flushDraft();
    applyAction({ type: "ADD_PAGE", page: createEmptyIdeaSketchPage(editorStateRef.current.document.pages.length) });
  }, [applyAction, flushDraft]);
  const duplicatePage = useCallback((pageId: string) => {
    if (readOnly) return;
    flushDraft();
    const sourcePage = editorStateRef.current.document.pages.find((page) => page.id === pageId);
    if (!sourcePage) return;
    const page = structuredClone(sourcePage);
    page.id = globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}`;
    page.title = `${sourcePage.title} (Copy)`;
    applyAction({ type: "DUPLICATE_PAGE", sourcePageId: pageId, page });
  }, [applyAction, flushDraft, readOnly]);
  const importPage = useCallback(async () => {
    if (readOnly) return;
    try {
      const { path, text } = await chooseExcalidrawFile();
      const scene = parseExcalidrawImport(JSON.parse(text) as unknown, path);
      flushDraft();
      const page = createIdeaSketchPageFromImport(scene, {
        title: scene.title,
      });
      applyAction({ type: "ADD_PAGE", page });
    } catch (error) {
      if (isDesktopOperationCancelled(error)) return;
      await message(`The Excalidraw page could not be imported: ${error instanceof Error ? error.message : String(error)}`, {
        title: "Import Error",
        kind: "error",
      });
    }
  }, [applyAction, flushDraft, readOnly]);
  const renamePage = useCallback((pageId: string, title: string) => {
    applyAction({ type: "RENAME_PAGE", pageId, title });
  }, [applyAction]);
  const reorderPage = useCallback((pageId: string, toIndex: number) => {
    flushDraft();
    applyAction({ type: "REORDER_PAGE", pageId, toIndex });
  }, [applyAction, flushDraft]);
  const deletePage = useCallback((pageId: string) => {
    flushDraft();
    applyAction({ type: "DELETE_PAGE", pageId });
  }, [applyAction, flushDraft]);

  const selectCamera = useCallback((camera: Camera) => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    setSelectedCameraId(camera.id);
    const element = api.getSceneElements().find((item: any) => item.id === camera.id);
    if (!element) return;
    api.setActiveTool({ type: "selection" });
    api.updateScene({ appState: { selectedElementIds: { [camera.id]: true } } });
    api.scrollToContent([element], { fitToContent: true, animate: true, duration: 300 });
  }, []);
  const deleteCamera = useCallback((cameraId: string) => {
    const api = excalidrawApiRef.current;
    if (!api || readOnly) return;
    api.updateScene({
      elements: draft.elements.filter((element: any) => element.id !== cameraId),
      ...(activeCameraId === cameraId ? { appState: { selectedElementIds: {} } } : {}),
    });
    if (activeCameraId === cameraId) setSelectedCameraId(undefined);
  }, [activeCameraId, draft.elements, readOnly]);
  const reorderCameraList = useCallback((orderedCameraIds: string[]) => {
    if (readOnly) return;
    excalidrawApiRef.current?.updateScene({ elements: reorderCameras(draft.elements, orderedCameraIds) });
  }, [draft.elements, readOnly]);
  const startPresentation = useCallback((mode: "preview" | "fullscreen") => {
    const model = flushAndGetDocument();
    const page = model.pages.find((candidate) => candidate.id === editorStateRef.current.activePageId);
    if (page) onStartPresentation(document.id, page, mode);
  }, [document.id, flushAndGetDocument, onStartPresentation]);
  const resolveActivePageForExport = useCallback(() => {
    const model = flushAndGetDocument();
    return model.pages.find((candidate) => candidate.id === editorStateRef.current.activePageId);
  }, [flushAndGetDocument]);
  const reportExportError = useCallback(async (error: unknown) => {
    if (isDesktopOperationCancelled(error)) return;
    await message(`The Page could not be exported: ${error instanceof Error ? error.message : String(error)}`, {
      title: "Export Error",
      kind: "error",
    });
  }, []);
  const exportActivePageAsExcalidraw = useCallback(async () => {
    const page = resolveActivePageForExport();
    if (!page) return;
    try {
      const result = await exportPageAsExcalidraw(page);
      if (result.status === "cancelled") return;
      excalidrawApiRef.current?.setToast({ message: `Exported ${result.fileName}`, duration: 4200 });
    } catch (error) {
      await reportExportError(error);
    }
  }, [reportExportError, resolveActivePageForExport]);
  const exportActivePageAsIdeaSketch = useCallback(async () => {
    const page = resolveActivePageForExport();
    if (!page) return;
    try {
      const result = await exportPageAsIdeaSketch(page);
      if (result.status === "cancelled") return;
      excalidrawApiRef.current?.setToast({ message: `Exported ${result.fileName}`, duration: 4200 });
    } catch (error) {
      await reportExportError(error);
    }
  }, [reportExportError, resolveActivePageForExport]);
  const handleApiReady = useCallback((api: any | undefined, slideId: string) => {
    if (!api) {
      if (excalidrawSlideIdRef.current !== slideId) return;
      sdkSceneCommitSettlementsRef.current.clear();
      excalidrawApiRef.current = null;
      excalidrawSlideIdRef.current = undefined;
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
  }, []);
  const handleConvertSelection = useCallback((target: StyleConversionTarget) => {
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

    const sceneElements = api.getSceneElements();
    const sceneAppState = api.getAppState();
    const selectedElementIds = sceneAppState.selectedElementIds as Record<string, boolean> | undefined;

    if (target === "current-page") {
      const result = buildCurrentPageStyleConversion(sceneElements, selectedElementIds);
      if (result.summary.converted === 0) return;
      api.updateScene({
        elements: refreshConvertedTextDimensions(
          result.elements,
          result.convertedElementIds,
        ),
        appState: { selectedElementIds: result.selectedElementIds },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      api.setToast({ message: formatStyleConversionSummary(result.summary), duration: 4200 });
      return;
    }

    const result = buildNewPageStyleConversion(
      sceneElements,
      selectedElementIds,
      api.getFiles(),
    );
    if (result.summary.converted === 0 || result.elements.length === 0) return;

    flushDraft();
    const sourcePage = editorStateRef.current.document.pages.find((page) => page.id === mountedPageId);
    if (!sourcePage) return;
    const pageIndex = editorStateRef.current.document.pages.length;
    const newPageBase = createEmptyIdeaSketchPage(pageIndex);
    const newPage: IdeaSketchPage = {
      ...newPageBase,
      title: `${newPageBase.title} – Clean style`,
      elements: refreshConvertedTextDimensions(
        result.elements,
        result.convertedElementIds,
      ),
      appState: {
        ...sourcePage.appState,
        selectedElementIds: result.selectedElementIds,
      },
      files: result.files,
    };
    pendingConversionFeedbackRef.current = {
      pageId: newPage.id,
      message: formatStyleConversionSummary(result.summary),
      selectedElementIds: result.selectedElementIds,
    };
    applyAction({ type: "ADD_PAGE", page: newPage });
  }, [applyAction, flushDraft, readOnly]);
  const openDrawer = useCallback((tab: IdeaSketchNavigatorTab) => {
    setNavigatorTab(tab);
    setDrawerOpen(true);
  }, []);
  const handleAddCamera = useCallback(() => {
    if (readOnly) return;
    openDrawer("cameras");
    setCameraDrawingRequestToken((token) => token + 1);
  }, [openDrawer, readOnly]);
  const handleCommandApiReady = useCallback((api: SlideCanvasCommandApi | undefined, slideId: string) => {
    if (api) {
      canvasCommandApiRef.current = api;
      canvasCommandSlideIdRef.current = slideId;
      setCanvasCommandReady(true);
      return;
    }
    if (canvasCommandSlideIdRef.current !== slideId) return;
    canvasCommandApiRef.current = undefined;
    canvasCommandSlideIdRef.current = undefined;
    setCanvasCommandReady(false);
  }, []);
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
    const drawingPlan = operations.length > 0 && operations.every(isIdeaSketchDrawingOperation)
      ? operations
      : undefined;
    const layoutPlan = operations.length > 0 && operations.every(isIdeaSketchLayoutOperation)
      ? operations
      : undefined;
    if (drawingPlan) {
      const api = excalidrawApiRef.current;
      if (
        drawingPlan.length > 40
        || !api
        || excalidrawSlideIdRef.current !== current.activePageId
        || drawingPlan.some((operation) => operation.pageId !== current.activePageId)
      ) return false;
      const page = current.document.pages.find((candidate) => candidate.id === current.activePageId);
      if (!page) return false;
      try {
        const plannedElements = buildIdeaSketchDrawingPlanScene(
          api.getSceneElements(),
          drawingPlan,
        );
        const restored = restoreElements(plannedElements as any[], null, {
          refreshDimensions: true,
          repairBindings: true,
        });
        api.updateScene({
          elements: restored as any[],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        return true;
      } catch {
        return false;
      }
    }
    if (layoutPlan) {
      const api = excalidrawApiRef.current;
      if (
        layoutPlan.length > 40
        || !api
        || excalidrawSlideIdRef.current !== current.activePageId
        || layoutPlan.some((operation) => operation.pageId !== current.activePageId)
      ) return false;
      const page = current.document.pages.find((candidate) => candidate.id === current.activePageId);
      if (!page) return false;
      try {
        const plannedElements = buildIdeaSketchLayoutPlanScene(
          api.getSceneElements(),
          layoutPlan,
        );
        const restored = restoreElements(plannedElements as any[], null, {
          refreshDimensions: true,
          repairBindings: true,
        });
        api.updateScene({
          elements: restored as any[],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        return true;
      } catch {
        return false;
      }
    }
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
    createToolExecutor: () => createAgentToolHost({
      extension: ideaSketchAgentExtension,
      context: {
        documentId: agentBindingStateRef.current.document.id,
        revision: agentBindingStateRef.current.document.revision,
        documentStatus: agentBindingStateRef.current.document.status,
        sourceModified: agentBindingStateRef.current.document.sourceModified,
        activeContextId: agentBindingStateRef.current.activeContextId,
        model: structuredClone(editorStateRef.current.document),
      },
    }),
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
              onExportImage={() => canvasCommandApiRef.current?.openImageExport()}
              onExportDrawio={() => canvasCommandApiRef.current?.exportDrawio()}
              onBackgroundChange={(color) => canvasCommandApiRef.current?.changeCanvasBackground(color)}
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
            onCommandApiReady={handleCommandApiReady}
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
          canvasCommandApiRef.current?.clearCanvas();
          setClearCanvasDialogOpen(false);
        }}
      />
    </div>
  );
}
