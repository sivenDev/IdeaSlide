import { CaptureUpdateAction, restoreElements } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentModel, DocumentSession, IdeaSketchDocument, IdeaSketchPage } from "../types";
import { useEditorSession } from "../hooks/useEditorSession";
import { useAutoSave } from "../hooks/useAutoSave";
import {
  createEmptyIdeaSketchPage,
  createIdeaSketchEditorState,
  ideaSketchReducer,
  type IdeaSketchAction,
  type IdeaSketchEditorState,
} from "../lib/ideaSketchReducer";
import { extractCameras, reorderCameras, type Camera } from "../lib/cameraUtils";
import {
  buildCurrentPageStyleConversion,
  buildNewPageStyleConversion,
  formatStyleConversionSummary,
  type StyleConversionTarget,
} from "../lib/excalidrawStyleConversion";
import { SlideCanvas } from "./SlideCanvas";
import { ResizableDivider } from "./ResizableDivider";
import type { ActiveAgentEditorBinding, AgentChangeSet } from "../lib/agent/types";
import { createAgentToolHost } from "../lib/agent/agentToolHost";
import {
  ideaSketchAgentExtension,
  getIdeaSketchSourceFingerprint,
  type IdeaSketchAgentOperation,
} from "../lib/agent/extensions/ideaSketchAgentExtension";
import {
  IdeaSketchNavigator,
  type IdeaSketchNavigatorTab,
} from "./IdeaSketchNavigator";
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 260;
const MIN_RIGHT_SIDEBAR_WIDTH = 220;
const MAX_RIGHT_SIDEBAR_WIDTH = 420;
const AGENT_HISTORY_LIMIT = 50;

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
  const [editorState, setEditorState] = useState<IdeaSketchEditorState>(() =>
    createIdeaSketchEditorState(document.model!, document.editorState?.activePageId),
  );
  const editorStateRef = useRef(editorState);
  const emittedModelRef = useRef<IdeaSketchDocument | undefined>(undefined);
  const [showNavigator, setShowNavigator] = useState(true);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(DEFAULT_RIGHT_SIDEBAR_WIDTH);
  const [navigatorTab, setNavigatorTab] = useState<IdeaSketchNavigatorTab>("pages");
  const [cameraDrawingRequestToken, setCameraDrawingRequestToken] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const [canvasInteractionActive, setCanvasInteractionActive] = useState(false);
  const canvasInteractionActiveRef = useRef(false);
  const manualCanvasMutationPendingRef = useRef(false);
  const excalidrawApiRef = useRef<any>(null);
  const excalidrawSlideIdRef = useRef<string | undefined>(undefined);
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
  const agentHistoryRef = useRef<{
    undo: IdeaSketchEditorState[];
    redo: IdeaSketchEditorState[];
  }>({ undo: [], redo: [] });
  const [agentHistoryVersion, setAgentHistoryVersion] = useState(0);
  const notifyAgentHistoryChanged = useCallback(() => {
    setAgentHistoryVersion((version) => version + 1);
  }, []);
  const clearAgentHistory = useCallback(() => {
    const history = agentHistoryRef.current;
    if (history.undo.length === 0 && history.redo.length === 0) return;
    agentHistoryRef.current = { undo: [], redo: [] };
    notifyAgentHistoryChanged();
  }, [notifyAgentHistoryChanged]);

  useEffect(() => {
    if (!document.model || document.model === emittedModelRef.current) return;
    const next = createIdeaSketchEditorState(document.model, document.editorState?.activePageId);
    clearAgentHistory();
    editorStateRef.current = next;
    setEditorState(next);
    const nextActivePage = next.document.pages.find((page) => page.id === next.activePageId);
    if (nextActivePage) syncMountedCanvasToPage(nextActivePage);
  }, [clearAgentHistory, document.editorState?.activePageId, document.model, syncMountedCanvasToPage]);

  const applyAction = useCallback((
    action: IdeaSketchAction,
    persistModel = true,
    preserveAgentHistory = false,
  ) => {
    const previous = editorStateRef.current;
    const next = ideaSketchReducer(previous, action);
    if (next === previous) return next;
    if (!preserveAgentHistory && next.document !== previous.document) clearAgentHistory();
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
  }, [clearAgentHistory, document.id, onEditorStateChange, onModelChange]);

  const activePage = editorState.document.pages.find((page) => page.id === editorState.activePageId)
    ?? editorState.document.pages[0]!;

  const handleCommit = useCallback((sessionId: string, pageId: string, payload: { slide: any }) => {
    if (sessionId !== document.id || payload.slide.id !== pageId) return;
    const preserveAgentHistory = !manualCanvasMutationPendingRef.current;
    manualCanvasMutationPendingRef.current = false;
    applyAction(
      { type: "UPDATE_PAGE_SCENE", pageId, page: payload.slide as IdeaSketchPage },
      true,
      preserveAgentHistory,
    );
  }, [applyAction, document.id]);
  const handleDirty = useCallback(() => {
    if (!readOnly) {
      if (canvasInteractionActiveRef.current) {
        manualCanvasMutationPendingRef.current = true;
        clearAgentHistory();
      }
      onDirty(document.id);
    }
  }, [clearAgentHistory, document.id, onDirty, readOnly]);
  const { autoSaveVersion, draft, flushDraft, getEditVersion, hasPendingCommit, updateDraft } = useEditorSession({
    documentSessionId: document.id,
    page: activePage,
    onCommit: handleCommit,
    onDirty: handleDirty,
  });

  const flushAndGetDocument = useCallback(() => {
    flushDraft();
    return editorStateRef.current.document;
  }, [flushDraft]);

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
    clearAgentHistory();
    api.updateScene({
      elements: draft.elements.filter((element: any) => element.id !== cameraId),
      ...(activeCameraId === cameraId ? { appState: { selectedElementIds: {} } } : {}),
    });
    if (activeCameraId === cameraId) setSelectedCameraId(undefined);
  }, [activeCameraId, clearAgentHistory, draft.elements, readOnly]);
  const reorderCameraList = useCallback((orderedCameraIds: string[]) => {
    if (readOnly) return;
    clearAgentHistory();
    excalidrawApiRef.current?.updateScene({ elements: reorderCameras(draft.elements, orderedCameraIds) });
  }, [clearAgentHistory, draft.elements, readOnly]);
  const startPresentation = useCallback((mode: "preview" | "fullscreen") => {
    const model = flushAndGetDocument();
    const page = model.pages.find((candidate) => candidate.id === editorStateRef.current.activePageId);
    if (page) onStartPresentation(document.id, page, mode);
  }, [document.id, flushAndGetDocument, onStartPresentation]);
  const handleApiReady = useCallback((api: any, slideId: string) => {
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
      clearAgentHistory();
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
  }, [applyAction, clearAgentHistory, flushDraft, readOnly]);
  const openNavigator = useCallback((tab: IdeaSketchNavigatorTab) => {
    setNavigatorTab(tab);
    setShowNavigator(true);
  }, []);
  const toggleNavigator = useCallback(() => setShowNavigator((visible) => !visible), []);
  const handleAddCamera = useCallback(() => {
    if (readOnly) return;
    openNavigator("cameras");
    setCameraDrawingRequestToken((token) => token + 1);
  }, [openNavigator, readOnly]);
  const handleCanvasInteractionChange = useCallback((active: boolean) => {
    canvasInteractionActiveRef.current = active;
    setCanvasInteractionActive((current) => current === active ? current : active);
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
    const previousHistory = agentHistoryRef.current;
    agentHistoryRef.current = {
      undo: [...previousHistory.undo, current].slice(-AGENT_HISTORY_LIMIT),
      redo: [],
    };
    notifyAgentHistoryChanged();
    try {
      for (const operation of operations) {
        if (operation.kind === "add-page") {
          const base = createEmptyIdeaSketchPage(editorStateRef.current.document.pages.length);
          const restored = restoreElements(operation.elements as any[], null, {
            refreshDimensions: true,
            repairBindings: true,
          });
          applyAction({
            type: "ADD_PAGE",
            page: { ...base, title: operation.title, elements: restored as any[] },
          }, true, true);
        } else if (operation.kind === "delete-page") {
          if (editorStateRef.current.document.pages.length <= 1) throw new Error("IdeaSketch must keep one Page");
          applyAction({ type: "DELETE_PAGE", pageId: operation.pageId }, true, true);
        } else if (operation.kind === "reorder-page") {
          applyAction({ type: "REORDER_PAGE", pageId: operation.pageId, toIndex: operation.toIndex }, true, true);
        } else {
          const page = editorStateRef.current.document.pages.find((candidate) => candidate.id === operation.pageId);
          if (!page) throw new Error("The target Page no longer exists");
          const restored = restoreElements(operation.elements as any[], null, {
            refreshDimensions: true,
            repairBindings: true,
          });
          const nextPage = { ...page, elements: restored as any[] };
          applyAction({
            type: "UPDATE_PAGE_SCENE",
            pageId: operation.pageId,
            page: nextPage,
          }, true, true);
          syncMountedCanvasToPage(nextPage);
        }
      }
      return true;
    } catch {
      agentHistoryRef.current = previousHistory;
      editorStateRef.current = current;
      setEditorState(current);
      emittedModelRef.current = current.document;
      onModelChange(document.id, current.document);
      onEditorStateChange(document.id, current.activePageId);
      notifyAgentHistoryChanged();
      return false;
    }
  }, [applyAction, document.id, document.revision, document.sourceModified, document.status, flushDraft, notifyAgentHistoryChanged, onEditorStateChange, onModelChange, readOnly, syncMountedCanvasToPage]);
  const restoreAgentSnapshot = useCallback((snapshot: IdeaSketchEditorState) => {
    editorStateRef.current = snapshot;
    setEditorState(snapshot);
    emittedModelRef.current = snapshot.document;
    setSelectedCameraId(undefined);
    onModelChange(document.id, snapshot.document);
    onEditorStateChange(document.id, snapshot.activePageId);
    const activeSnapshotPage = snapshot.document.pages.find((page) => page.id === snapshot.activePageId);
    if (activeSnapshotPage) syncMountedCanvasToPage(activeSnapshotPage);
  }, [document.id, onEditorStateChange, onModelChange, syncMountedCanvasToPage]);
  const handleUndoAgentChange = useCallback(() => {
    const history = agentHistoryRef.current;
    const previous = history.undo[history.undo.length - 1];
    if (!previous || readOnly) return;
    agentHistoryRef.current = {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, editorStateRef.current].slice(-AGENT_HISTORY_LIMIT),
    };
    restoreAgentSnapshot(previous);
    notifyAgentHistoryChanged();
  }, [notifyAgentHistoryChanged, readOnly, restoreAgentSnapshot]);
  const handleRedoAgentChange = useCallback(() => {
    const history = agentHistoryRef.current;
    const next = history.redo[history.redo.length - 1];
    if (!next || readOnly) return;
    agentHistoryRef.current = {
      undo: [...history.undo, editorStateRef.current].slice(-AGENT_HISTORY_LIMIT),
      redo: history.redo.slice(0, -1),
    };
    restoreAgentSnapshot(next);
    notifyAgentHistoryChanged();
  }, [notifyAgentHistoryChanged, readOnly, restoreAgentSnapshot]);
  const agentBindingStateRef = useRef({
    document,
    activeContextId: editorState.activePageId,
    readOnly,
    applyChangeSet: handleApplyAgentChangeSet,
    undo: handleUndoAgentChange,
    redo: handleRedoAgentChange,
  });
  agentBindingStateRef.current = {
    document,
    activeContextId: editorState.activePageId,
    readOnly,
    applyChangeSet: handleApplyAgentChangeSet,
    undo: handleUndoAgentChange,
    redo: handleRedoAgentChange,
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
    undo: () => agentBindingStateRef.current.undo(),
    redo: () => agentBindingStateRef.current.redo(),
    get canUndo() { return agentHistoryRef.current.undo.length > 0; },
    get canRedo() { return agentHistoryRef.current.redo.length > 0; },
  }), [agentHistoryVersion, document.id]);

  useEffect(() => {
    onAgentBindingChange(agentBinding, document.id);
  }, [agentBinding, document.id, onAgentBindingChange]);

  useEffect(() => () => {
    onAgentBindingChange(undefined, document.id);
  }, [document.id, onAgentBindingChange]);

  return (
    <div className="ideanote-ideasketch-editor">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <SlideCanvas
            key={draft.slideId}
            slideId={draft.slideId}
            pageTitle={activePage.title}
            elements={draft.elements}
            appState={draft.appState}
            files={draft.files}
            onChange={updateDraft}
            onApiReady={handleApiReady}
            onConvertSelection={handleConvertSelection}
            onInteractionChange={handleCanvasInteractionChange}
            viewMode={readOnly}
            editorRefreshToken={editorRefreshToken}
            cameraDrawingRequestToken={cameraDrawingRequestToken}
          />
        </main>
        <ResizableDivider
          side="right"
          isVisible={showNavigator}
          onToggle={toggleNavigator}
          size={rightSidebarWidth}
          minSize={MIN_RIGHT_SIDEBAR_WIDTH}
          maxSize={MAX_RIGHT_SIDEBAR_WIDTH}
          onResize={(nextSize) => setRightSidebarWidth(Math.max(MIN_RIGHT_SIDEBAR_WIDTH, Math.min(MAX_RIGHT_SIDEBAR_WIDTH, nextSize)))}
        />
        <div className="h-full flex-shrink-0 overflow-hidden transition-[width] duration-200" style={{ width: showNavigator ? rightSidebarWidth : 0 }}>
          <div className="h-full" style={{ width: rightSidebarWidth }}>
            <IdeaSketchNavigator
              activeTab={navigatorTab}
              onTabChange={setNavigatorTab}
              pages={editorState.document.pages}
              activePageId={editorState.activePageId}
              activePageDraft={draft}
              canvasInteractionActive={canvasInteractionActive}
              cameras={cameras}
              activeCameraId={activeCameraId}
              readOnly={readOnly}
              onPageSelect={selectPage}
              onPageAdd={addPage}
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
        </div>
      </div>
    </div>
  );
}
