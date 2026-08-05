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
import {
  IdeaSketchNavigator,
  type IdeaSketchNavigatorTab,
} from "./IdeaSketchNavigator";
const NAVIGATOR_PANEL_WIDTH = 220;

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
}: IdeaSketchEditorProps) {
  if (!document.model) throw new Error("IdeaSketch document model is missing");
  const [editorState, setEditorState] = useState<IdeaSketchEditorState>(() =>
    createIdeaSketchEditorState(document.model!, document.editorState?.activePageId),
  );
  const editorStateRef = useRef(editorState);
  const emittedModelRef = useRef<IdeaSketchDocument | undefined>(undefined);
  const [showNavigator, setShowNavigator] = useState(true);
  const [navigatorTab, setNavigatorTab] = useState<IdeaSketchNavigatorTab>("pages");
  const [cameraDrawingRequestToken, setCameraDrawingRequestToken] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const excalidrawApiRef = useRef<any>(null);
  const excalidrawSlideIdRef = useRef<string | undefined>(undefined);
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
  }, [document.editorState?.activePageId, document.model]);

  const applyAction = useCallback((action: IdeaSketchAction, persistModel = true) => {
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
    enabled: document.mode === "workspace" && !readOnly && document.status === "editable",
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
    if (!readOnly) excalidrawApiRef.current?.updateScene({ elements: reorderCameras(draft.elements, orderedCameraIds) });
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
  return (
    <div className="ideanote-ideasketch-editor">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <SlideCanvas
            slideId={draft.slideId}
            elements={draft.elements}
            appState={draft.appState}
            files={draft.files}
            onChange={updateDraft}
            onApiReady={handleApiReady}
            onConvertSelection={handleConvertSelection}
            viewMode={readOnly}
            editorRefreshToken={editorRefreshToken}
            cameraDrawingRequestToken={cameraDrawingRequestToken}
          />
        </main>
        <ResizableDivider side="right" isVisible={showNavigator} onToggle={toggleNavigator} />
        <div className="h-full flex-shrink-0 overflow-hidden transition-[width] duration-200" style={{ width: showNavigator ? NAVIGATOR_PANEL_WIDTH : 0 }}>
          <div className="h-full" style={{ width: NAVIGATOR_PANEL_WIDTH }}>
            <IdeaSketchNavigator
              activeTab={navigatorTab}
              onTabChange={setNavigatorTab}
              pages={editorState.document.pages}
              activePageId={editorState.activePageId}
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
