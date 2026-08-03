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
import { SlideCanvas } from "./SlideCanvas";
import { ResizableDivider } from "./ResizableDivider";
import {
  IdeaSketchNavigator,
  type IdeaSketchNavigatorTab,
} from "./IdeaSketchNavigator";
const NAVIGATOR_PANEL_WIDTH = 244;

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
  const [showNavigator, setShowNavigator] = useState(false);
  const [navigatorTab, setNavigatorTab] = useState<IdeaSketchNavigatorTab>("pages");
  const [cameraDrawingRequestToken, setCameraDrawingRequestToken] = useState(0);
  const [selectedCameraId, setSelectedCameraId] = useState<string>();
  const excalidrawApiRef = useRef<any>(null);

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
  const handleApiReady = useCallback((api: any) => {
    excalidrawApiRef.current = api;
  }, []);
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
            slideId={activePage.id}
            elements={draft.elements}
            appState={draft.appState}
            files={draft.files}
            onChange={updateDraft}
            onApiReady={handleApiReady}
            viewMode={readOnly}
            editorRefreshToken={editorRefreshToken}
            isNavigatorOpen={showNavigator}
            onToggleNavigator={toggleNavigator}
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
