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

  useEffect(() => {
    if (!document.model || document.model === emittedModelRef.current) return;
    const next = createIdeaSketchEditorState(document.model, document.editorState?.activePageId);
    editorStateRef.current = next;
    setEditorState(next);
    const nextActivePage = next.document.pages.find((page) => page.id === next.activePageId);
    if (nextActivePage) syncMountedCanvasToPage(nextActivePage);
  }, [document.editorState?.activePageId, document.model, syncMountedCanvasToPage]);

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
